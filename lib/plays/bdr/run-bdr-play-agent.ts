import type { CompanyInput, BatchContactInput } from '@/lib/schemas';
import type { CompanyAgentOutput } from '@/lib/agent/schemas';
import { selectBdrSequence } from './classify';
import { sequenceFor } from './sequences';
import { BDR_PLAY_ID } from './types';
import { researchForBdrSequence, type BdrResearchProvider, type BdrResearchFinding } from './research';

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'company';
}

function splitName(contact: BatchContactInput) {
  if (contact.first_name || contact.last_name) return { first_name: contact.first_name, last_name: contact.last_name };
  const parts = contact.name?.trim().split(/\s+/).filter(Boolean) ?? [];
  return { first_name: parts[0], last_name: parts.length > 1 ? parts.slice(1).join(' ') : undefined };
}

function html(text: string) {
  return text.split(/\n{2,}/).map((paragraph) => `<p>${paragraph.replace(/\n/g, '<br />')}</p>`).join('');
}

function replaceCommonTokens(value: string, replacements: Record<string, string | undefined>) {
  let output = value;
  for (const [token, replacement] of Object.entries(replacements)) {
    if (replacement) output = output.replaceAll(token, replacement);
  }
  return output;
}

function renderStep1(body: string, fallback: string | undefined, finding: BdrResearchFinding) {
  const replacements: Record<string, string | undefined> = {
    '[PRODUCT_OR_COLLECTION]': finding.value,
    '[PRODUCT_OR_CATEGORY]': finding.value,
    '[DIGITAL_SIGNAL]': finding.value,
    '[SUBSCRIPTION_SIGNAL]': finding.value,
  };
  const source = finding.value ? body : (fallback ?? body);
  return replaceCommonTokens(source, replacements);
}

function renderStep4(versionA: string | undefined, versionB: string, finding: BdrResearchFinding) {
  if (finding.value && versionA) {
    return replaceCommonTokens(versionA, {
      '[REVIEW_PATTERN]': finding.value,
      '[OPEN_SUPPORT_ROLES]': finding.value,
      '[DIGITAL_SIGNAL]': finding.value,
    });
  }
  return versionB;
}

function contactEmail(company: CompanyInput, contact: BatchContactInput, index: number) {
  return contact.email ?? `missing-contact-${index + 1}+${slug(company.company_name)}@example.invalid`;
}

export async function runBdrPlayAgent({ company, researchProvider }: { company: CompanyInput; researchProvider?: BdrResearchProvider }): Promise<CompanyAgentOutput> {
  const inputContacts = company.contacts?.length ? company.contacts : [{ name: 'Contact needed', title: undefined }];
  const outputContacts: CompanyAgentOutput['contacts'] = [];
  const evidenceLedger: CompanyAgentOutput['evidence_ledger'] = [];

  for (let index = 0; index < inputContacts.length; index++) {
    const input = inputContacts[index];
    const names = splitName(input);
    const email = contactEmail(company, input, index);
    const selection = selectBdrSequence(company, input.title);
    const warnings = [...selection.warnings];

    if (!input.email) warnings.push('No verified contact email supplied; candidate is non-pushable until a real email is added.');
    if (!input.title) warnings.push('Contact title is required for BDR sequence mapping.');

    if (!selection.sequence_code) {
      outputContacts.push({
        email,
        first_name: names.first_name,
        last_name: names.last_name,
        title: input.title,
        company: input.company ?? company.company_name,
        primary_angle: 'BDR sequence mapping needs review before outreach can be generated.',
        opening_hook: 'Missing or unsupported BDR persona/category.',
        proof_used: 'No template selected.',
        guardrail: 'Do not approve until brand type, title, and sequence mapping are confirmed.',
        sequence_code: undefined,
        play_metadata: { play_id: BDR_PLAY_ID, brand: selection.brand, persona: selection.persona },
        evidence_urls: [],
        qa_warnings: warnings,
        emails: [{
          step_number: 1,
          original_step_number: 1,
          step_label: 'Step 1: Email · needs sequence mapping',
          subject: 'Sequence mapping needed',
          body_text: '{{first_name}} --- confirm the right BDR sequence before sending.',
          body_html: '<p>{{first_name}} --- confirm the right BDR sequence before sending.</p>',
        }],
      });
      continue;
    }

    const sequence = sequenceFor(selection.sequence_code);
    const research = await researchForBdrSequence(company, sequence, researchProvider);
    evidenceLedger.push(...research.account.slice(0, 4).map((item) => ({
      claim: item.quote_or_fact.slice(0, 500),
      source_url: item.source_url,
      evidence_type: item.evidence_type === 'public_fact' ? 'public_fact' as const : 'inference' as const,
      confidence: item.confidence,
    })));
    const researchWarnings = [research.step1.warning, research.step4.warning].filter(Boolean) as string[];
    warnings.push(...researchWarnings);

    const step1Text = renderStep1(sequence.step1.body, sequence.step1.fallback_body, research.step1);
    const step4Text = renderStep4(sequence.step4.version_a?.body, sequence.step4.version_b.body, research.step4);
    const evidenceUrls = [...research.step1.evidence_urls, ...research.step4.evidence_urls, ...research.account.map((item) => item.source_url)].filter(Boolean);

    outputContacts.push({
      email,
      first_name: names.first_name,
      last_name: names.last_name,
      title: input.title,
      company: input.company ?? company.company_name,
      primary_angle: `${sequence.brand_label} x ${sequence.persona_label}: ${selection.sequence_code}`,
      opening_hook: research.step1.value ?? `BDR ${selection.sequence_code} template fallback used for ${company.company_name}.`,
      proof_used: research.step4.value ?? 'Template benchmark fallback used.',
      guardrail: 'Review all public-source personalization before approving. Merge tokens must stay intact.',
      sequence_code: selection.sequence_code,
      play_metadata: {
        play_id: BDR_PLAY_ID,
        sequence_code: selection.sequence_code,
        brand_type: sequence.brand_label,
        persona: sequence.persona_label,
      },
      evidence_urls: evidenceUrls,
      qa_warnings: warnings,
      emails: [
        {
          step_number: 1,
          original_step_number: 1,
          step_label: sequence.step1.label,
          subject: sequence.step1.subject,
          body_text: step1Text,
          body_html: html(step1Text),
        },
        {
          step_number: 2,
          original_step_number: 4,
          step_label: sequence.step4.label,
          subject: sequence.step4.subject,
          body_text: step4Text,
          body_html: html(step4Text),
        },
      ],
    });
  }

  if (evidenceLedger.length === 0) {
    evidenceLedger.push({ claim: 'BDR play ran with no public research evidence; review warnings on contacts before approving.', evidence_type: 'guardrail', confidence: 'medium' });
  }

  return {
    company_name: company.company_name,
    domain: company.domain,
    core_hypothesis: `${company.company_name} can be sequenced through the BDR cold outbound play when brand type and persona mapping are confirmed.`,
    evidence_ledger: evidenceLedger,
    contacts: outputContacts,
  };
}
