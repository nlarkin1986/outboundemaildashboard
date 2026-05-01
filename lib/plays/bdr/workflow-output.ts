import type { CompanyAgentOutput } from '@/lib/agent/schemas';
import type { BatchContactInput, CompanyInput } from '@/lib/schemas';
import { sanitizeBdrPersonalizationValue } from './personalization';
import { sequenceFor } from './sequences';
import { BDR_PLAY_ID, type BdrPersonalizationInsert, type BdrPlaceholderResearch, type BdrSequencePlan, type BdrSequenceTemplate } from './types';

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

function insertForFinding(company: CompanyInput, finding?: BdrPlaceholderResearch['step1'] | BdrPlaceholderResearch['step4']): BdrPersonalizationInsert | undefined {
  if (!finding) return undefined;
  if (finding.insert) return finding.insert;
  const selected = sanitizeBdrPersonalizationValue({ value: finding.value, lookup: finding.lookup, companyName: company.company_name });
  if (!selected) {
    return finding.warning ? {
      confidence: 'low',
      evidence_type: 'inference',
      fallback_used: true,
      warning: finding.warning,
    } : undefined;
  }
  return {
    selected_insert: selected,
    confidence: 'medium',
    evidence_type: finding.lookup === 'review_pattern' ? 'reviews' : 'inference',
    verified_fact: finding.value,
    source_url: finding.evidence_urls[0],
    source_snippet: finding.value?.slice(0, 240),
    fallback_used: false,
  };
}

function renderStep1(company: CompanyInput, body: string, fallback: string | undefined, finding?: BdrPlaceholderResearch['step1']) {
  const insert = insertForFinding(company, finding);
  const value = insert?.fallback_used ? undefined : insert?.selected_insert;
  const replacements: Record<string, string | undefined> = {
    '[PRODUCT_OR_COLLECTION]': value,
    '[PRODUCT_OR_CATEGORY]': value,
    '[DIGITAL_SIGNAL]': value,
    '[SUBSCRIPTION_SIGNAL]': value,
  };
  const source = value ? body : (fallback ?? body);
  return replaceCommonTokens(source, replacements);
}

function renderStep4(company: CompanyInput, versionA: string | undefined, versionB: string, finding?: BdrPlaceholderResearch['step4']) {
  const insert = insertForFinding(company, finding);
  const value = insert?.fallback_used ? undefined : insert?.selected_insert;
  if (value && versionA) {
    return replaceCommonTokens(versionA, {
      '[REVIEW_PATTERN]': value,
      '[OPEN_SUPPORT_ROLES]': value,
      '[DIGITAL_SIGNAL]': value,
    });
  }
  return versionB;
}

function renderLinkedInNote(sequence: BdrSequenceTemplate, replacements: Record<string, string | undefined>) {
  if (!sequence.linkedin) return undefined;
  return {
    ...sequence.linkedin,
    note: replaceCommonTokens(sequence.linkedin.note, replacements),
  };
}

function contactEmail(company: CompanyInput, contact: BatchContactInput, index: number) {
  return contact.email ?? `missing-contact-${index + 1}+${slug(company.company_name)}@example.invalid`;
}

export function renderBdrWorkflowOutput({
  company,
  contacts,
  plans,
  placeholderResearch,
}: {
  company: CompanyInput;
  contacts: BatchContactInput[];
  plans: BdrSequencePlan[];
  placeholderResearch: Map<string, BdrPlaceholderResearch>;
}): CompanyAgentOutput {
  const outputContacts: CompanyAgentOutput['contacts'] = [];
  const evidenceLedger: CompanyAgentOutput['evidence_ledger'] = [];

  plans.forEach((plan) => {
    for (const claim of plan.evidence_claims) {
      evidenceLedger.push({ claim, source_url: plan.evidence_urls[0], evidence_type: 'public_fact', confidence: plan.confidence });
    }
  });

  contacts.forEach((input, index) => {
    const names = splitName(input);
    const email = contactEmail(company, input, index);
    const plan = plans[index];
    const warnings = [...(plan?.warnings ?? [])];
    const isDiscoveredCandidate = !input.email && Boolean(input.name || input.first_name || input.last_name) && Boolean(input.title);

    if (!input.email) warnings.push('No verified contact email supplied; candidate is non-pushable until a real email is added.');
    if (isDiscoveredCandidate) warnings.push('Contact candidate was discovered from public people search; verify current title/company and add a real email before approving for push.');
    if (!input.title) warnings.push('Contact title is required for BDR sequence mapping.');

    if (!plan?.sequence_code) {
      outputContacts.push({
        email,
        first_name: names.first_name,
        last_name: names.last_name,
        title: input.title,
        company: input.company ?? company.company_name,
        primary_angle: 'BDR sequence mapping needs review before outreach can be generated.',
        opening_hook: 'Missing or unsupported BDR persona/category.',
        proof_used: plan?.evidence_claims[0] ?? 'No template selected.',
        guardrail: 'Do not approve until brand type, title, and sequence mapping are confirmed.',
        sequence_code: undefined,
        play_metadata: { play_id: BDR_PLAY_ID, brand: plan?.sequence?.brand, persona: plan?.sequence?.persona, sequence_plan_confidence: plan?.confidence },
        evidence_urls: plan?.evidence_urls ?? [],
        qa_warnings: warnings,
        emails: [{
          step_number: 1,
          original_step_number: 1,
          step_label: 'Step 1: Email · needs sequence mapping',
          subject: 'Sequence mapping needed',
          body_text: '{{first_name}}, confirm the right BDR sequence before sending.',
          body_html: '<p>{{first_name}}, confirm the right BDR sequence before sending.</p>',
        }],
      });
      return;
    }

    const sequence = sequenceFor(plan.sequence_code);
    const research = placeholderResearch.get(plan.contact_key);
    warnings.push(...(research?.warnings ?? []));
    const step1Insert = insertForFinding(company, research?.step1);
    const step4Insert = insertForFinding(company, research?.step4);
    const step1Personalization = step1Insert?.fallback_used ? undefined : step1Insert?.selected_insert;
    const step4Personalization = step4Insert?.fallback_used ? undefined : step4Insert?.selected_insert;
    if (step1Insert?.warning && !warnings.includes(step1Insert.warning)) warnings.push(step1Insert.warning);
    if (step4Insert?.warning && !warnings.includes(step4Insert.warning)) warnings.push(step4Insert.warning);
    const step1Text = renderStep1(company, sequence.step1.body, sequence.step1.fallback_body, research?.step1);
    const step4Text = renderStep4(company, sequence.step4.version_a?.body, sequence.step4.version_b.body, research?.step4);
    const linkedin = renderLinkedInNote(sequence, {
      '{{first_name}}': names.first_name,
      '{{company}}': input.company ?? company.company_name,
      '{{sender.first_name}}': '{{sender.first_name}}',
    });
    const evidenceUrls = [
      ...(plan.evidence_urls ?? []),
      ...(research?.step1.evidence_urls ?? []),
      ...(research?.step4.evidence_urls ?? []),
      ...(research?.account_evidence_urls ?? []),
    ].filter(Boolean);

    outputContacts.push({
      email,
      first_name: names.first_name,
      last_name: names.last_name,
      title: input.title,
      company: input.company ?? company.company_name,
      primary_angle: `${sequence.brand_label} x ${sequence.persona_label}: ${plan.sequence_code}`,
      opening_hook: step1Personalization ?? `BDR ${plan.sequence_code} template fallback used for ${company.company_name}.`,
      proof_used: step4Personalization ?? plan.evidence_claims[0] ?? 'Template benchmark fallback used.',
      guardrail: 'Review all public-source personalization before approving. Merge tokens must stay intact.',
      sequence_code: plan.sequence_code,
      play_metadata: {
        play_id: BDR_PLAY_ID,
        sequence_code: plan.sequence_code,
        brand_type: sequence.brand_label,
        persona: sequence.persona_label,
        sequence_plan_confidence: plan.confidence,
        required_lookups: plan.required_lookups,
        personalization: { step1: step1Insert, step4: step4Insert },
        linkedin_note: linkedin,
      },
      evidence_urls: [...new Set(evidenceUrls)],
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
  });

  if (evidenceLedger.length === 0) {
    evidenceLedger.push({ claim: 'BDR play ran with no public research evidence; review warnings on contacts before approving.', evidence_type: 'guardrail', confidence: 'medium' });
  }

  return {
    company_name: company.company_name,
    domain: company.domain,
    core_hypothesis: `${company.company_name} can be sequenced through the BDR cold outbound play when brand type and persona mapping are confirmed.`,
    evidence_ledger: evidenceLedger.slice(0, 12),
    contacts: outputContacts,
  };
}
