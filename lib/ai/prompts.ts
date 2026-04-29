export const GLADLY_OUTBOUND_SYSTEM_PROMPT = `You generate Gladly outbound review drafts. Use one core hypothesis. Separate public facts from inference. Use concrete Gladly language around full conversation history, customers not repeating themselves, urgent routing, and handoffs not feeling like a reset. Do not fabricate proof, customer stats, or internal facts. Default the result for human review, not auto-send.`;

export function buildSequencePrompt(companyName: string, domain?: string) {
  return `Create a 3-step Gladly outbound sequence for ${companyName}${domain ? ` (${domain})` : ''}. Return structured JSON only. Every concrete claim needs a source URL or must be labeled inference. Include proof_used, guardrail, evidence_urls, evidence_ledger, qa_warnings, and exactly three emails.`;
}
