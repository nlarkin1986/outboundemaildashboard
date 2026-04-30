import { runCompanyAgent } from '@/lib/agent/run-company-agent';
import { runBdrPlayAgent } from '@/lib/plays/bdr/run-bdr-play-agent';
import { BDR_PLAY_ID } from '@/lib/plays/bdr/types';
import { attachRunToBatch, createRun, getBatchById, listBatchRuns, recordCoworkMessage, reviewUrlForBatchToken, saveResearchArtifact, saveReviewState, updateBatchRunStatus, updateBatchStatus } from '@/lib/store';
import { postCoworkBatchReady } from '@/lib/cowork/client';
import type { BatchContactInput, CompanyInput, ContactInput } from '@/lib/schemas';

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

function splitName(contact: BatchContactInput) {
  if (contact.first_name || contact.last_name) return { first_name: contact.first_name, last_name: contact.last_name };
  const parts = contact.name?.trim().split(/\s+/).filter(Boolean) ?? [];
  return { first_name: parts[0], last_name: parts.length > 1 ? parts.slice(1).join(' ') : undefined };
}

function normalizeBatchContact(company: CompanyInput, contact: BatchContactInput, index: number): ContactInput {
  const names = splitName(contact);
  return {
    first_name: names.first_name,
    last_name: names.last_name,
    title: contact.title,
    company: contact.company ?? company.company_name,
    email: contact.email ?? `missing-contact-${index + 1}+${slug(company.company_name)}@example.invalid`,
    domain: contact.domain ?? company.domain,
  };
}

function batchCompanyKey(company: CompanyInput) {
  const domain = company.domain?.trim().toLowerCase();
  if (domain) return `domain:${domain}`;
  return `name:${company.company_name.trim().toLowerCase().replace(/\s+/g, ' ')}`;
}

export async function processBatch(batchId: string) {
  const batch = await getBatchById(batchId);
  if (!batch) throw new Error(`Batch not found: ${batchId}`);
  await updateBatchStatus(batchId, 'processing');

  let failures = 0;
  let pending = 0;
  const existingRuns = new Map((await listBatchRuns(batchId)).map((run) => [run.company_key ?? batchCompanyKey(run), run]));
  for (const company of batch.companies) {
    const companyKey = batchCompanyKey(company);
    const existing = existingRuns.get(companyKey);
    if (existing?.status === 'ready_for_review') continue;
    if (existing?.status === 'failed') {
      failures += 1;
      continue;
    }
    if (existing) {
      pending += 1;
      continue;
    }

    let runId = '';
    try {
      const hasContacts = (company.contacts?.length ?? 0) > 0;
      const normalizedInputContacts = hasContacts ? company.contacts!.map((contact, index) => normalizeBatchContact(company, contact, index)) : undefined;
      const companyForAgent = normalizedInputContacts ? { ...company, contacts: normalizedInputContacts } : company;
      const agentOutput = batch.play_id === BDR_PLAY_ID
        ? await runBdrPlayAgent({ company })
        : await runCompanyAgent({ company: companyForAgent, targetPersona: undefined });
      const runContacts = hasContacts
        ? normalizedInputContacts!
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
        play_id: batch.play_id,
        play_metadata: batch.play_metadata,
        account_id: batch.account_id,
        created_by_user_id: batch.created_by_user_id,
        created_by: batch.requested_by,
      });
      runId = run.id;
      await attachRunToBatch(batchId, run.id, company, 'researching');
      existingRuns.set(companyKey, { batch_id: batchId, run_id: run.id, company_key: companyKey, company_name: company.company_name, domain: company.domain, status: 'researching', created_at: run.created_at, updated_at: run.updated_at });
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
            sequence_code: agentContact.sequence_code,
            play_metadata: agentContact.play_metadata,
            evidence_urls: agentContact.evidence_urls,
            qa_warnings: agentContact.qa_warnings,
            emails: agentContact.emails.map((agentEmail) => {
              const existingEmail = contact.emails.find((candidate) => candidate.step_number === agentEmail.step_number);
              return {
                ...(existingEmail ?? { id: undefined, contact_id: contact.id, original_subject: agentEmail.subject, original_body_html: agentEmail.body_html }),
                step_number: agentEmail.step_number,
                original_step_number: agentEmail.original_step_number,
                step_label: agentEmail.step_label,
                subject: agentEmail.subject,
                body_html: agentEmail.body_html,
                body_text: agentEmail.body_text,
              };
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

  const finalStatus = pending ? 'processing' : failures ? 'partially_failed' : 'ready_for_review';
  await updateBatchStatus(batchId, finalStatus);
  const reviewUrl = batch.review_url || reviewUrlForBatchToken(batch.review_token);
  if (pending) return { ok: true as const, batch_id: batchId, status: finalStatus, review_url: reviewUrl, failures };
  let message;
  try {
    message = await postCoworkBatchReady({ batchId, threadId: batch.cowork_thread_id, reviewUrl });
  } catch (error) {
    message = { status: 'failed' as const, error: error instanceof Error ? error.message : String(error) };
  }
  await recordCoworkMessage({ batch_id: batchId, thread_id: batch.cowork_thread_id, direction: 'outbound', status: message.status, payload: { text: `Your outbound dashboard is ready: ${reviewUrl}`, review_url: reviewUrl, account_id: batch.account_id, created_by_user_id: batch.created_by_user_id, created_by: batch.requested_by }, response: message.response, error: message.error });
  return { ok: true as const, batch_id: batchId, status: finalStatus, review_url: reviewUrl, failures };
}
