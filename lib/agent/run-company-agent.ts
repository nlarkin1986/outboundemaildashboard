import type { BatchContactInput, ContactInput } from '@/lib/schemas';
import type { CompanyInput } from '@/lib/schemas';
import { anthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import { z } from 'zod';
import { findPeopleWithExa, searchPublicWeb, searchWithExa } from '@/lib/ai/tools';
import { companyAgentOutputSchema, type CompanyAgentOutput } from './schemas';

const genericCompanyAgentOutputSchema = z.object({
  company_name: z.string(),
  domain: z.string().optional(),
  core_hypothesis: z.string(),
  evidence_ledger: z.array(z.object({
    claim: z.string(),
    source_url: z.string().optional(),
    evidence_type: z.enum(['public_fact', 'inference', 'guardrail']),
    confidence: z.enum(['high', 'medium', 'low']),
  })),
  contacts: z.array(z.object({
    email: z.string(),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    title: z.string().optional(),
    company: z.string(),
    primary_angle: z.string(),
    opening_hook: z.string(),
    proof_used: z.string(),
    guardrail: z.string().optional(),
    sequence_code: z.string().optional(),
    play_metadata: z.object({}).passthrough().optional(),
    evidence_urls: z.array(z.string()).default([]),
    qa_warnings: z.array(z.string()).default([]),
    emails: z.array(z.object({
      step_number: z.number(),
      original_step_number: z.number().optional(),
      step_label: z.string().optional(),
      subject: z.string(),
      body_text: z.string(),
      body_html: z.string(),
    })).min(1),
  })),
});

type GenericCompanyAgentOutput = z.infer<typeof genericCompanyAgentOutputSchema>;

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'company';
}

function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return {
    first_name: parts[0],
    last_name: parts.length > 1 ? parts.slice(1).join(' ') : undefined,
  };
}

function missingContactWarning() {
  return 'No verified contact email supplied; candidate is non-pushable until a real email is added.';
}

function hasEmail(contact: BatchContactInput): contact is ContactInput {
  return typeof contact.email === 'string' && contact.email.length > 0;
}

function contactFromCandidate(company: CompanyInput, candidate: { name: string; title?: string; linkedin_url?: string }, index: number): ContactInput {
  const names = splitName(candidate.name);
  return {
    ...names,
    title: candidate.title ?? 'Contact candidate',
    company: company.company_name,
    email: `contact-candidate-${index + 1}+${slug(company.company_name)}@example.invalid`,
    domain: company.domain,
  };
}

function emailsForContact(companyName: string, first: string) {
  return [
    { step_number: 1 as const, subject: `${companyName} support context`, body_html: `<p>Hi ${first},</p><p>I was mapping where customer conversations can lose context as teams move between channels, queues, and follow-up owners.</p><p>Gladly helps support teams keep the customer story in one place so the next reply starts with context instead of recap.</p>`, body_text: `Hi ${first}, I was mapping where customer conversations can lose context as teams move between channels, queues, and follow-up owners. Gladly helps support teams keep the customer story in one place so the next reply starts with context instead of recap.` },
    { step_number: 2 as const, subject: `quick question on ${companyName}`, body_html: `<p>Hi ${first},</p><p>For teams with growing customer volume, the expensive moments are often the ones where an agent needs order details, prior conversations, and urgency signals at the same time.</p><p>Is that a workflow your team is looking at this quarter?</p>`, body_text: `Hi ${first}, For teams with growing customer volume, the expensive moments are often the ones where an agent needs order details, prior conversations, and urgency signals at the same time. Is that a workflow your team is looking at this quarter?` },
    { step_number: 3 as const, subject: `worth a compare?`, body_html: `<p>Hi ${first},</p><p>Last note from me. Gladly is built around people-centered customer service, giving agents conversation history and customer context in one workspace.</p><p>Open to comparing notes on whether that would matter for ${companyName}?</p>`, body_text: `Hi ${first}, Last note from me. Gladly is built around people-centered customer service, giving agents conversation history and customer context in one workspace. Open to comparing notes on whether that would matter for ${companyName}?` },
  ];
}

function genericAgentEnabled() {
  return Boolean(process.env.ANTHROPIC_API_KEY) && process.env.GENERIC_COMPANY_AGENT_DISABLED !== 'true';
}

function genericAgentInstructions() {
  return [
    'You are the generic/custom outbound research and writing agent for Gladly.',
    'Use tools for public research; do not fill account-specific claims from memory.',
    'Use the supplied public research and people candidates as evidence. Prefer concise public facts from official pages and credible snippets.',
    'Write review-ready outbound emails for the supplied contacts or discovered contact candidates.',
    'If contacts are supplied, keep their email addresses exactly as supplied and write for those contacts.',
    'If no contacts are supplied, use findPeople for likely target personas. If a discovered person has no verified email, use a contact-candidate example.invalid placeholder and add a qa warning that the email must be verified before push.',
    'Prefer official sources and credible public sources. Label inference clearly in the evidence ledger.',
    'Do not invent customers, metrics, implementations, integrations, job counts, review themes, or executive initiatives.',
    'Do not use the fallback subjects "handoffs without the reset", "full conversation history", or "before it becomes urgent".',
    'Use simple HTML paragraphs in body_html that match body_text.',
    'Return exactly 2 concise emails per contact unless the request strongly implies a different sequence length.',
  ].join('\n');
}

function validUrl(value?: string) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

function htmlFromText(text: string) {
  return text.split(/\n{2,}/).map((part) => `<p>${part.trim()}</p>`).join('');
}

function suppliedContactAt(company: CompanyInput, index: number) {
  const contact = company.contacts?.[index];
  if (!contact?.email) return undefined;
  const names = contact.first_name || contact.last_name
    ? { first_name: contact.first_name, last_name: contact.last_name }
    : splitName(contact.name ?? '');
  return {
    email: contact.email,
    first_name: names.first_name,
    last_name: names.last_name,
    title: contact.title,
    company: contact.company ?? company.company_name,
  };
}

function normalizeAgentOutput(output: GenericCompanyAgentOutput, company: CompanyInput): CompanyAgentOutput {
  return companyAgentOutputSchema.parse({
    ...output,
    company_name: output.company_name || company.company_name,
    domain: output.domain || company.domain,
    evidence_ledger: output.evidence_ledger.map((item) => ({
      ...item,
      source_url: validUrl(item.source_url),
    })),
    contacts: output.contacts.map((contact, index) => {
      const supplied = suppliedContactAt(company, index);
      return {
        ...contact,
        ...supplied,
        email: (supplied?.email ?? contact.email).toLowerCase(),
        company: supplied?.company ?? contact.company ?? company.company_name,
        evidence_urls: contact.evidence_urls.map(validUrl).filter((url): url is string => Boolean(url)),
        emails: contact.emails.map((email, emailIndex) => ({
          ...email,
          step_number: Number.isFinite(email.step_number) && email.step_number > 0 ? Math.round(email.step_number) : emailIndex + 1,
          original_step_number: email.original_step_number && Number.isFinite(email.original_step_number) && email.original_step_number > 0 ? Math.round(email.original_step_number) : undefined,
          body_text: email.body_text || email.body_html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
          body_html: email.body_html || htmlFromText(email.body_text),
        })),
      };
    }),
  });
}

async function runCompanyAgentWithSdk({ company, targetPersona }: { company: CompanyInput; targetPersona?: string }): Promise<CompanyAgentOutput | undefined> {
  if (!genericAgentEnabled()) return undefined;
  const research = await searchPublicWeb(`${company.company_name} ${company.domain ?? ''} customer support ecommerce operations`, company.domain, 3);
  const people = (company.contacts?.length ?? 0) > 0 ? [] : await findPeopleWithExa(company.company_name, company.domain, targetPersona);

  const result = await generateObject({
    model: anthropic(process.env.GENERIC_COMPANY_AGENT_MODEL ?? 'claude-haiku-4-5'),
    schema: genericCompanyAgentOutputSchema,
    system: genericAgentInstructions(),
    temperature: 0.2,
    maxOutputTokens: 1800,
    prompt: JSON.stringify({
      company,
      target_persona: targetPersona,
      public_research: research,
      people_candidates: people,
      output_requirements: {
        company_name: 'Use the supplied company name.',
        evidence_ledger: 'Include public facts, inferences, and guardrails. Every public fact should have a source_url.',
        contacts: 'Use supplied contacts when present. Otherwise call findPeople and clearly mark placeholder emails as non-pushable.',
        emails: 'Write concise, specific Gladly outbound emails grounded in the evidence ledger.',
      },
    }),
  });

  const output = normalizeAgentOutput(result.object, company);
  if (output.contacts.length === 0) return undefined;
  return output;
}

async function runFallbackCompanyAgent({ company, targetPersona }: { company: CompanyInput; targetPersona?: string }): Promise<CompanyAgentOutput> {
  const research = await searchWithExa(company.company_name, company.domain);
  const people = (company.contacts?.length ?? 0) > 0 ? [] : await findPeopleWithExa(company.company_name, company.domain, targetPersona);
  const inputContacts: ContactInput[] = company.contacts?.length ? company.contacts.filter(hasEmail) : people.map((candidate, index) => contactFromCandidate(company, candidate, index));
  const peopleByEmail = new Map(inputContacts.map((contact, index) => [contact.email.toLowerCase(), people[index]]));

  const evidence_ledger = [
    ...research.slice(0, 6).map((item) => ({
      claim: item.quote_or_fact.slice(0, 500),
      source_url: item.source_url,
      evidence_type: item.evidence_type === 'public_fact' ? 'public_fact' as const : 'inference' as const,
      confidence: item.confidence,
    })),
    {
      claim: inputContacts.length
        ? company.contacts?.length ? 'Contacts supplied by Cowork input.' : 'Contact candidates discovered from public LinkedIn/people search; emails are placeholders until verified.'
        : 'No contacts supplied and no public contact candidates were found.',
      evidence_type: 'guardrail' as const,
      confidence: 'high' as const,
    },
  ];

  const sourceUrls = research.map((item) => item.source_url).filter(Boolean);

  const contacts = inputContacts.map((contact) => {
    const first = contact.first_name || 'there';
    const candidate = peopleByEmail.get(contact.email.toLowerCase());
    const isCandidateWithoutEmail = contact.email.endsWith('.invalid');
    const primaryAngle = 'handoffs where the next teammate needs the full customer story instead of asking customers to repeat themselves';
    return {
      email: contact.email,
      first_name: contact.first_name,
      last_name: contact.last_name,
      title: contact.title,
      company: contact.company ?? company.company_name,
      primary_angle: primaryAngle,
      opening_hook: `When ${company.company_name} customers move across channels, the next handoff should not feel like a reset.`,
      proof_used: 'Gladly customer-service platform positioning; verify account-specific proof before approval.',
      guardrail: isCandidateWithoutEmail
        ? 'Contact candidate came from public people search; verify title/current company and add a real email before approving for push.'
        : 'Account angle is based on public evidence and clearly labeled inference; confirm before approving.',
      evidence_urls: [candidate?.linkedin_url, ...sourceUrls].filter(Boolean) as string[],
      qa_warnings: isCandidateWithoutEmail ? [missingContactWarning()] : [],
      emails: emailsForContact(company.company_name, first),
    };
  });

  return {
    company_name: company.company_name,
    domain: company.domain,
    core_hypothesis: `${company.company_name} likely benefits from CX workflows where ${targetPersona ?? 'support leaders'} can preserve full conversation history across urgent handoffs.`,
    evidence_ledger,
    contacts,
  };
}

export async function runCompanyAgent({ company, targetPersona }: { company: CompanyInput; targetPersona?: string }): Promise<CompanyAgentOutput> {
  try {
    const agentOutput = await runCompanyAgentWithSdk({ company, targetPersona });
    if (agentOutput) return agentOutput;
  } catch (error) {
    console.error('Generic company agent failed; using fallback writer', { error: error instanceof Error ? error.message : String(error) });
  }
  return runFallbackCompanyAgent({ company, targetPersona });
}
