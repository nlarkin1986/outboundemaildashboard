import type { BatchContactInput, ContactInput } from '@/lib/schemas';
import type { CompanyInput } from '@/lib/schemas';
import { findPeopleWithExa, searchWithExa } from '@/lib/ai/tools';
import type { CompanyAgentOutput } from './schemas';

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
    { step_number: 1 as const, subject: 'handoffs without the reset', body_html: `<p>Hi ${first},</p><p>When a customer issue becomes urgent, the handoff cannot feel like a reset.</p><p>Gladly helps teams give agents the full customer story across channels, so customers do not have to repeat themselves.</p>`, body_text: `Hi ${first}, When a customer issue becomes urgent, the handoff cannot feel like a reset. Gladly helps teams give agents the full customer story across channels, so customers do not have to repeat themselves.` },
    { step_number: 2 as const, subject: 'full conversation history', body_html: `<p>Hi ${first},</p><p>The operational risk is not just response time. It is whether the next teammate can see prior conversations, order context, and urgency right away.</p><p>Worth comparing notes on where that shows up for ${companyName}?</p>`, body_text: `Hi ${first}, The operational risk is not just response time. It is whether the next teammate can see prior conversations, order context, and urgency right away. Worth comparing notes on where that shows up for ${companyName}?` },
    { step_number: 3 as const, subject: 'before it becomes urgent', body_html: `<p>Hi ${first},</p><p>Last note from me. Gladly brings customer-system context and conversation history together so teams can intelligently route urgent conversations with the right history attached.</p><p>Open to a quick look?</p>`, body_text: `Hi ${first}, Last note from me. Gladly brings customer-system context and conversation history together so teams can intelligently route urgent conversations with the right history attached. Open to a quick look?` },
  ];
}

export async function runCompanyAgent({ company, targetPersona }: { company: CompanyInput; targetPersona?: string }): Promise<CompanyAgentOutput> {
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
      proof_used: 'KUHL: 44% reduction in WISMO emails; 79% email resolution rate',
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
