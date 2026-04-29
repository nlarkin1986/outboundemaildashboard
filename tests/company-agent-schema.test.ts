import { describe, expect, it } from 'vitest';
import { companyAgentOutputSchema } from '@/lib/agent/schemas';

describe('company agent output schema', () => {
  it('rejects malformed email sequences', () => {
    const result = companyAgentOutputSchema.safeParse({
      company_name: 'Bad Co',
      core_hypothesis: 'test',
      evidence_ledger: [],
      contacts: [{
        email: 'person@example.com',
        company: 'Bad Co',
        primary_angle: 'angle',
        opening_hook: 'hook',
        proof_used: 'proof',
        emails: [
          { step_number: 1, subject: 'one', body_text: 'one', body_html: '<p>one</p>' },
          { step_number: 2, subject: 'two', body_text: 'two', body_html: '<p>two</p>' },
        ],
      }],
    });
    expect(result.success).toBe(false);
  });
});
