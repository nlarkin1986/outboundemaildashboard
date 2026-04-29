import { runCompanyAgent } from '@/lib/agent/run-company-agent';
import { attachRunToBatch, createRun, getBatchById, recordCoworkMessage, reviewUrlForBatchToken, saveResearchArtifact, saveReviewState, updateBatchRunStatus, updateBatchStatus } from '@/lib/store';
import { postCoworkBatchReady } from '@/lib/cowork/client';
import type { CompanyInput } from '@/lib/schemas';

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'company';
}

function placeholderContact(company: CompanyInput) {
  return {
    first_name: 'Account',
    last_name: 'Draft',
    title: 'Contact needed',
    company: company.company_name,
    email: `missing-contact+${slug(company.company_name)}@example.invalid`,
    domain: company.domain,
  };
}

export async function processBatch(batchId: string) {
  const batch = await getBatchById(batchId);
  if (!batch) throw new Error(`Batch not found: ${batchId}`);
  await updateBatchStatus(batchId, 'processing');

  let failures = 0;
  for (const company of batch.companies) {
    let runId = '';
    try {
      const hasContacts = (company.contacts?.length ?? 0) > 0;
      const agentOutput = await runCompanyAgent({ company, targetPersona: undefined });
      const runContacts = hasContacts
        ? company.contacts!
        : agentOutput.contacts.length
          ? agentOutput.contacts.map((contact) => ({
            first_name: contact.first_name,
            last_name: contact.last_name,
            title: contact.title,
            company: contact.company,
            email: contact.email,
            domain: company.domain,
          }))
          : [placeholderContact(company)];
      const run = await createRun({
        company_name: company.company_name,
        domain: company.domain,
        contacts: runContacts,
        campaign_id: batch.campaign_id,
        cowork_thread_id: batch.cowork_thread_id,
        mode: batch.mode,
        source: 'cowork',
        account_id: batch.account_id,
        created_by_user_id: batch.created_by_user_id,
        created_by: batch.requested_by,
      });
      runId = run.id;
      await attachRunToBatch(batchId, run.id, company, 'researching');
      await saveResearchArtifact(run.id, { company_name: company.company_name, domain: company.domain, core_hypothesis: agentOutput.core_hypothesis, evidence_ledger: agentOutput.evidence_ledger, source_urls: agentOutput.evidence_ledger.map((e) => e.source_url).filter(Boolean) as string[], raw_summary: agentOutput });
      await updateBatchRunStatus(batchId, run.id, 'writing');
      const state = await import('@/lib/store').then((store) => store.generateDraftForRun(run.id));
      const agentContactsByEmail = new Map(agentOutput.contacts.map((contact) => [contact.email.toLowerCase(), contact]));
      await saveReviewState(run.review_token, {
        contacts: state.contacts.map((contact) => {
          const agentContact = agentContactsByEmail.get(contact.email.toLowerCase());
          if (!agentContact) {
            return !hasContacts
              ? { ...contact, status: 'needs_edit' as const, qa_warnings: [...contact.qa_warnings, 'No contacts supplied; cannot push to Instantly until contacts/emails are added.'] }
              : contact;
          }
          return {
            ...contact,
            primary_angle: agentContact.primary_angle,
            opening_hook: agentContact.opening_hook,
            proof_used: agentContact.proof_used,
            guardrail: agentContact.guardrail,
            evidence_urls: agentContact.evidence_urls,
            qa_warnings: agentContact.qa_warnings,
            emails: contact.emails.map((email) => {
              const agentEmail = agentContact.emails.find((candidate) => candidate.step_number === email.step_number);
              return agentEmail ? { ...email, subject: agentEmail.subject, body_html: agentEmail.body_html, body_text: agentEmail.body_text } : email;
            }),
          };
        }),
      });
      await updateBatchRunStatus(batchId, run.id, 'ready_for_review');
    } catch (error) {
      failures += 1;
      if (runId) await updateBatchRunStatus(batchId, runId, 'failed', error instanceof Error ? error.message : String(error));
    }
  }

  await updateBatchStatus(batchId, failures ? 'partially_failed' : 'ready_for_review');
  const reviewUrl = batch.review_url || reviewUrlForBatchToken(batch.review_token);
  let message;
  try {
    message = await postCoworkBatchReady({ batchId, threadId: batch.cowork_thread_id, reviewUrl });
  } catch (error) {
    message = { status: 'failed' as const, error: error instanceof Error ? error.message : String(error) };
  }
  await recordCoworkMessage({ batch_id: batchId, thread_id: batch.cowork_thread_id, direction: 'outbound', status: message.status, payload: { text: `Your outbound dashboard is ready: ${reviewUrl}`, review_url: reviewUrl, account_id: batch.account_id, created_by_user_id: batch.created_by_user_id, created_by: batch.requested_by }, response: message.response, error: message.error });
  return { ok: true as const, batch_id: batchId, status: failures ? 'partially_failed' : 'ready_for_review', review_url: reviewUrl, failures };
}
