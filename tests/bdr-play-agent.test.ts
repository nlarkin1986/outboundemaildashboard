import { describe, expect, it, vi } from 'vitest';
import { runBdrPlayAgent } from '@/lib/plays/bdr/run-bdr-play-agent';
import type { BdrResearchProvider } from '@/lib/plays/bdr/research';

function provider(overrides: Partial<BdrResearchProvider> = {}): BdrResearchProvider {
  return {
    accountResearch: vi.fn(async () => [{ source_url: 'https://example.com/source', quote_or_fact: 'Public account research', evidence_type: 'public_fact' as const, confidence: 'medium' as const }]),
    heroProduct: vi.fn(async () => ({ value: 'Prague hands-free sneaker', evidence_urls: ['https://example.com/product'] })),
    complexProduct: vi.fn(async () => ({ value: 'OLED home theater system', evidence_urls: ['https://example.com/catalog'] })),
    digitalSignal: vi.fn(async () => ({ value: 'new commerce platform rollout', evidence_urls: ['https://example.com/press'] })),
    subscriptionSignal: vi.fn(async () => ({ value: 'monthly replenishment subscription', evidence_urls: ['https://example.com/subscribe'] })),
    reviewPattern: vi.fn(async () => ({ value: 'sizing questions showing up in multiple negative reviews', evidence_urls: ['https://example.com/reviews'] })),
    supportJobs: vi.fn(async () => ({ value: '3', evidence_urls: ['https://example.com/jobs'] })),
    ...overrides,
  };
}

describe('BDR play agent', () => {
  it('generates A-1 Step 1 and Step 4 drafts from selected research', async () => {
    const researchProvider = provider();
    const output = await runBdrPlayAgent({
      company: {
        company_name: 'Kizik',
        domain: 'kizik.com',
        contacts: [{ first_name: 'Alex', last_name: 'Morgan', title: 'VP of Customer Experience', email: 'alex@example.com' }],
      },
      researchProvider,
    });

    expect(output.contacts).toHaveLength(1);
    const contact = output.contacts[0];
    expect(contact.sequence_code).toBe('A-1');
    expect(contact.emails).toHaveLength(2);
    expect(contact.emails[0]).toMatchObject({ original_step_number: 1, step_label: 'Step 1: Email · peer story' });
    expect(contact.emails[1]).toMatchObject({ original_step_number: 4, step_label: 'Step 4: Email · benchmarks / data' });
    expect(contact.emails[0].body_text).toContain('Prague hands-free sneaker');
    expect(contact.emails[1].body_text).toContain('customers mention fit and sizing questions in public reviews');
    expect(researchProvider.heroProduct).toHaveBeenCalled();
    expect(researchProvider.reviewPattern).toHaveBeenCalled();
    expect(contact.qa_warnings).toEqual([]);
  });

  it('uses Step 4 fallback and records warnings when review research is thin', async () => {
    const output = await runBdrPlayAgent({
      company: {
        company_name: 'Kizik',
        domain: 'kizik.com',
        contacts: [{ first_name: 'Alex', title: 'VP of Customer Experience', email: 'alex@example.com' }],
      },
      researchProvider: provider({ reviewPattern: vi.fn(async () => ({ evidence_urls: [], warning: 'No repeated review pattern found; used Step 4 Version B.' })) }),
    });

    expect(output.contacts[0].emails[1].body_text).toContain('We have benchmarks');
    expect(output.contacts[0].qa_warnings.join(' ')).toMatch(/No repeated review pattern/);
  });

  it('marks missing emails as non-pushable placeholders', async () => {
    const output = await runBdrPlayAgent({
      company: {
        company_name: 'LG Electronics',
        domain: 'lg.com',
        contacts: [{ name: 'Girish Joshi', title: 'Director of E-commerce' }],
      },
      researchProvider: provider(),
    });

    expect(output.contacts[0].email).toMatch(/@example\.invalid$/);
    expect(output.contacts[0].sequence_code).toBe('D-2');
    expect(output.contacts[0].qa_warnings.join(' ')).toMatch(/No verified contact email/);
  });

  it('does not invent a sequence for unsupported titles', async () => {
    const output = await runBdrPlayAgent({
      company: {
        company_name: 'Kizik',
        domain: 'kizik.com',
        contacts: [{ first_name: 'Casey', title: 'Chief Marketing Officer', email: 'casey@example.com' }],
      },
      researchProvider: provider(),
    });

    expect(output.contacts[0].sequence_code).toBeUndefined();
    expect(output.contacts[0].emails[0].subject).toBe('Sequence mapping needed');
    expect(output.contacts[0].qa_warnings.join(' ')).toMatch(/Unsupported persona/);
  });
});
