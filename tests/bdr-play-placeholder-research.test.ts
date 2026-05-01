import { describe, expect, it, vi } from 'vitest';
import { createBdrSequencePlans } from '@/lib/plays/bdr/sequence-plan';
import { researchBdrPlaceholders } from '@/lib/plays/bdr/placeholder-research';
import type { BdrResearchProvider } from '@/lib/plays/bdr/research';

function provider(overrides: Partial<BdrResearchProvider> = {}): BdrResearchProvider {
  return {
    accountResearch: vi.fn(async () => [{ source_url: 'https://example.com/account', quote_or_fact: 'Kizik sells hands-free sneakers.', evidence_type: 'public_fact' as const, confidence: 'medium' as const }]),
    heroProduct: vi.fn(async () => ({ value: 'Prague hands-free sneaker', evidence_urls: ['https://example.com/product'] })),
    complexProduct: vi.fn(async () => ({ value: 'OLED home theater system', evidence_urls: ['https://example.com/catalog'] })),
    digitalSignal: vi.fn(async () => ({ value: 'commerce platform rollout', evidence_urls: ['https://example.com/digital'] })),
    subscriptionSignal: vi.fn(async () => ({ value: 'monthly replenishment subscription', evidence_urls: ['https://example.com/subscription'] })),
    reviewPattern: vi.fn(async () => ({ value: 'sizing questions appear in negative reviews', evidence_urls: ['https://example.com/reviews'] })),
    supportJobs: vi.fn(async () => ({ value: '4', evidence_urls: ['https://example.com/jobs'] })),
    ...overrides,
  };
}

describe('BDR placeholder research pass', () => {
  it('researches only the selected sequence placeholder lookups', async () => {
    const researchProvider = provider();
    const { plans } = await createBdrSequencePlans({
      company: {
        company_name: 'Kizik',
        domain: 'kizik.com',
        contacts: [{ first_name: 'Alex', title: 'VP of Customer Experience', email: 'alex@example.com' }],
      },
      contacts: [{ first_name: 'Alex', title: 'VP of Customer Experience', email: 'alex@example.com' }],
      researchProvider,
    });

    const result = await researchBdrPlaceholders({
      company: { company_name: 'Kizik', domain: 'kizik.com' },
      plan: plans[0],
      researchProvider,
    });

    expect(result).toMatchObject({
      sequence_code: 'A-1',
      step1: {
        lookup: 'hero_product',
        value: 'Prague hands-free sneaker',
        insert: {
          selected_insert: "Kizik's Prague hands-free sneaker can put fit, sizing, or product-comparison questions in the buying moment",
          fallback_used: false,
        },
      },
      step4: {
        lookup: 'review_pattern',
        value: 'sizing questions appear in negative reviews',
        insert: {
          selected_insert: 'customers mention fit and sizing questions in public reviews',
          fallback_used: false,
        },
      },
    });
    expect(researchProvider.heroProduct).toHaveBeenCalledTimes(1);
    expect(researchProvider.reviewPattern).toHaveBeenCalledTimes(1);
    expect(researchProvider.complexProduct).not.toHaveBeenCalled();
    expect(researchProvider.supportJobs).not.toHaveBeenCalled();
  });

  it('keeps fallback warnings when selected placeholder evidence is thin', async () => {
    const researchProvider = provider({
      reviewPattern: vi.fn(async () => ({ evidence_urls: [], warning: 'No repeated review pattern found; used Step 4 Version B.' })),
    });
    const { plans } = await createBdrSequencePlans({
      company: {
        company_name: 'Kizik',
        domain: 'kizik.com',
        contacts: [{ first_name: 'Alex', title: 'VP of Customer Experience', email: 'alex@example.com' }],
      },
      contacts: [{ first_name: 'Alex', title: 'VP of Customer Experience', email: 'alex@example.com' }],
      researchProvider,
    });

    const result = await researchBdrPlaceholders({
      company: { company_name: 'Kizik', domain: 'kizik.com' },
      plan: plans[0],
      researchProvider,
    });

    expect(result?.warnings.join(' ')).toMatch(/No repeated review pattern/);
    expect(result?.step4.value).toBeUndefined();
    expect(result?.step4.insert).toMatchObject({ fallback_used: true, confidence: 'low' });
  });
});
