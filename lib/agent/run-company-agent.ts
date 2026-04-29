import type { CompanyInput } from '@/lib/schemas';
import type { CompanyAgentOutput } from './schemas';

function missingContactWarning() {
  return 'No contacts supplied; cannot push to Instantly until contacts/emails are added.';
}

export async function runCompanyAgent({ company, targetPersona }: { company: CompanyInput; targetPersona?: string }): Promise<CompanyAgentOutput> {
  const contacts = (company.contacts ?? []).map((contact) => {
    const first = contact.first_name || 'there';
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
      guardrail: 'Account angle is based on public/inferred operational needs; confirm against sourced evidence before approving.',
      evidence_urls: company.domain ? [`https://${company.domain}`] : [],
      qa_warnings: [],
      emails: [
        { step_number: 1 as const, subject: 'handoffs without the reset', body_html: `<p>Hi ${first},</p><p>When a customer issue becomes urgent, the handoff cannot feel like a reset.</p><p>Gladly helps teams give agents the full customer story across channels, so customers do not have to repeat themselves.</p>`, body_text: `Hi ${first}, When a customer issue becomes urgent, the handoff cannot feel like a reset. Gladly helps teams give agents the full customer story across channels, so customers do not have to repeat themselves.` },
        { step_number: 2 as const, subject: 'full conversation history', body_html: `<p>Hi ${first},</p><p>The operational risk is not just response time. It is whether the next teammate can see prior conversations, order context, and urgency right away.</p><p>Worth comparing notes on where that shows up for ${company.company_name}?</p>`, body_text: `Hi ${first}, The operational risk is not just response time. It is whether the next teammate can see prior conversations, order context, and urgency right away. Worth comparing notes on where that shows up for ${company.company_name}?` },
        { step_number: 3 as const, subject: 'before it becomes urgent', body_html: `<p>Hi ${first},</p><p>Last note from me. Gladly brings customer-system context and conversation history together so teams can intelligently route urgent conversations with the right history attached.</p><p>Open to a quick look?</p>`, body_text: `Hi ${first}, Last note from me. Gladly brings customer-system context and conversation history together so teams can intelligently route urgent conversations with the right history attached. Open to a quick look?` },
      ],
    };
  });

  return {
    company_name: company.company_name,
    domain: company.domain,
    core_hypothesis: `${company.company_name} likely benefits from CX workflows where ${targetPersona ?? 'support leaders'} can preserve full conversation history across urgent handoffs.`,
    evidence_ledger: [
      { claim: 'Company/domain supplied by Cowork input.', source_url: company.domain ? `https://${company.domain}` : undefined, evidence_type: 'public_fact', confidence: company.domain ? 'medium' : 'low' },
      { claim: contacts.length ? 'Contacts supplied by Cowork input.' : missingContactWarning(), evidence_type: 'guardrail', confidence: 'high' },
    ],
    contacts,
  };
}
