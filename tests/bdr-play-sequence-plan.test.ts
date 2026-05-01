import { describe, expect, it, vi } from 'vitest';
import { createBdrSequencePlans } from '@/lib/plays/bdr/sequence-plan';
import type { BdrResearchProvider } from '@/lib/plays/bdr/research';

function provider(accountText: string): Pick<BdrResearchProvider, 'accountResearch'> {
  return {
    accountResearch: vi.fn(async () => [{
      source_url: 'https://example.com/account',
      source_title: 'Account research',
      quote_or_fact: accountText,
      evidence_type: 'public_fact' as const,
      confidence: 'medium' as const,
    }]),
  };
}

describe('BDR sequence planning pass', () => {
  it('returns selected sequence requirements without rendering email copy', async () => {
    const result = await createBdrSequencePlans({
      company: {
        company_name: 'Kizik',
        domain: 'kizik.com',
        contacts: [{ first_name: 'Alex', title: 'VP of Customer Experience', email: 'alex@example.com' }],
      },
      contacts: [{ first_name: 'Alex', title: 'VP of Customer Experience', email: 'alex@example.com' }],
      researchProvider: provider('Kizik sells hands-free shoes and sneakers where sizing and fit matter.'),
    });

    expect(result.plans[0]).toMatchObject({
      sequence_code: 'A-1',
      required_lookups: ['hero_product', 'review_pattern'],
      confidence: 'high',
    });
    expect(result.plans[0].evidence_claims[0]).toContain('hands-free shoes');
    expect(JSON.stringify(result.plans[0])).not.toContain('Worth 20 minutes');
  });

  it('uses public account evidence to strengthen an ambiguous brand classification', async () => {
    const result = await createBdrSequencePlans({
      company: {
        company_name: 'Acme Goods',
        domain: 'acmegoods.com',
        contacts: [{ first_name: 'Sam', title: 'Director of E-commerce', email: 'sam@example.com' }],
      },
      contacts: [{ first_name: 'Sam', title: 'Director of E-commerce', email: 'sam@example.com' }],
      researchProvider: provider('Acme Goods is a furniture brand selling customizable sofas and high ticket sectionals.'),
    });

    expect(result.plans[0].sequence_code).toBe('D-2');
    expect(result.plans[0].warnings).toEqual([]);
  });

  it('maps daily supplement subscription brands to replenishment commerce', async () => {
    const result = await createBdrSequencePlans({
      company: {
        company_name: 'Grüns',
        domain: 'gruns.co',
        contacts: [{ first_name: 'Jillian', title: 'Director of Retail Operations', email: 'jillian@example.com' }],
      },
      contacts: [{ first_name: 'Jillian', title: 'Director of Retail Operations', email: 'jillian@example.com' }],
      researchProvider: provider('Grüns sells daily nutrition gummies, vitamins, supplements, and subscription packs for recurring wellness routines.'),
    });

    expect(result.plans[0].sequence_code).toBe('D-3');
    expect(result.plans[0].sequence?.brand.label).toBe('Subscription & replenishment');
    expect(result.plans[0].sequence?.persona.label).toBe('eCommerce Leader');
  });

  it('returns a warning-only plan for unsupported personas', async () => {
    const result = await createBdrSequencePlans({
      company: {
        company_name: 'Kizik',
        domain: 'kizik.com',
        contacts: [{ first_name: 'Casey', title: 'Chief Marketing Officer', email: 'casey@example.com' }],
      },
      contacts: [{ first_name: 'Casey', title: 'Chief Marketing Officer', email: 'casey@example.com' }],
      researchProvider: provider('Kizik sells shoes and sneakers.'),
    });

    expect(result.plans[0].sequence_code).toBeUndefined();
    expect(result.plans[0].confidence).toBe('low');
    expect(result.plans[0].warnings.join(' ')).toMatch(/Unsupported persona/);
  });
});
