import { describe, expect, it, vi } from 'vitest';
import { runBdrPlayWorkflow } from '@/lib/plays/bdr/workflow-runner';
import type { BdrResearchProvider } from '@/lib/plays/bdr/research';

function provider(overrides: Partial<BdrResearchProvider> = {}): BdrResearchProvider {
  return {
    accountResearch: vi.fn(async () => [{ source_url: 'https://example.com/account', quote_or_fact: 'Kizik sells hands-free sneakers where sizing and fit questions matter.', evidence_type: 'public_fact' as const, confidence: 'medium' as const }]),
    heroProduct: vi.fn(async () => ({ value: 'Prague hands-free sneaker', evidence_urls: ['https://example.com/product'] })),
    complexProduct: vi.fn(async () => ({ value: 'OLED home theater system', evidence_urls: ['https://example.com/catalog'] })),
    digitalSignal: vi.fn(async () => ({ value: 'commerce platform rollout', evidence_urls: ['https://example.com/digital'] })),
    subscriptionSignal: vi.fn(async () => ({ value: 'monthly replenishment subscription', evidence_urls: ['https://example.com/subscription'] })),
    reviewPattern: vi.fn(async () => ({ value: 'sizing questions in negative reviews', evidence_urls: ['https://example.com/reviews'] })),
    supportJobs: vi.fn(async () => ({ value: '4', evidence_urls: ['https://example.com/jobs'] })),
    ...overrides,
  };
}

describe('BDR play workflow runner', () => {
  it('runs sequence planning before placeholder research and renders review output', async () => {
    const researchProvider = provider();

    const result = await runBdrPlayWorkflow({
      company: {
        company_name: 'Kizik',
        domain: 'kizik.com',
        contacts: [{ first_name: 'Alex', last_name: 'Morgan', title: 'VP of Customer Experience', email: 'alex@example.com' }],
      },
      researchProvider,
    });

    expect(result.sequence_plans[0]).toMatchObject({ sequence_code: 'A-1', required_lookups: ['hero_product', 'review_pattern'] });
    expect(result.placeholder_research[0]).toMatchObject({ sequence_code: 'A-1', step1: { value: 'Prague hands-free sneaker' } });
    expect(result.output.contacts[0].sequence_code).toBe('A-1');
    expect(result.output.contacts[0].emails.map((email) => email.original_step_number)).toEqual([1, 4]);
    expect(result.output.contacts[0].emails[0].body_text).toContain('Prague hands-free sneaker');
    expect(result.output.contacts[0].emails[1].body_text).toContain('customers mention fit and sizing questions in public reviews');
  });

  it('returns warning-only review output when no sequence can be selected', async () => {
    const result = await runBdrPlayWorkflow({
      company: {
        company_name: 'Kizik',
        domain: 'kizik.com',
        contacts: [{ first_name: 'Casey', title: 'Chief Marketing Officer', email: 'casey@example.com' }],
      },
      researchProvider: provider(),
    });

    expect(result.sequence_plans[0].sequence_code).toBeUndefined();
    expect(result.placeholder_research).toHaveLength(0);
    expect(result.output.contacts[0].sequence_code).toBeUndefined();
    expect(result.output.contacts[0].qa_warnings.join(' ')).toMatch(/Unsupported persona/);
    expect(result.output.contacts[0].emails[0].subject).toBe('Sequence mapping needed');
  });

  it('plans and drafts a Quince.com BDR scenario from account evidence', async () => {
    const researchProvider = provider({
      accountResearch: vi.fn(async () => [{
        source_url: 'https://www.quince.com/',
        source_title: 'Quince',
        quote_or_fact: 'Quince sells apparel, clothing, cashmere sweaters, washable silk, and home goods online.',
        evidence_type: 'public_fact' as const,
        confidence: 'medium' as const,
      }]),
      heroProduct: vi.fn(async () => ({ value: 'washable silk collection', evidence_urls: ['https://www.quince.com/women/silk'] })),
      reviewPattern: vi.fn(async () => ({ value: 'fit and sizing questions show up in customer reviews', evidence_urls: ['https://example.com/quince-reviews'] })),
    });

    const result = await runBdrPlayWorkflow({
      company: {
        company_name: 'Quince',
        domain: 'quince.com',
        contacts: [{ name: 'Jordan Lee', title: 'VP of Customer Experience', email: 'jordan@example.com' }],
      },
      researchProvider,
    });

    expect(result.sequence_plans[0]).toMatchObject({
      sequence_code: 'A-1',
      required_lookups: ['hero_product', 'review_pattern'],
      confidence: 'high',
    });
    expect(result.placeholder_research[0]).toMatchObject({
      sequence_code: 'A-1',
      step1: { lookup: 'hero_product', value: 'washable silk collection' },
      step4: { lookup: 'review_pattern', value: 'fit and sizing questions show up in customer reviews' },
    });
    expect(result.output.contacts[0]).toMatchObject({
      company: 'Quince',
      sequence_code: 'A-1',
      primary_angle: 'High return rate x VP / Director of CX: A-1',
    });
    expect(result.output.contacts[0].play_metadata?.linkedin_note).toMatchObject({
      label: 'Step 2: LinkedIn · connection note',
      max_length: 200,
    });
    expect(JSON.stringify(result.output.contacts[0])).not.toMatch(/---|\[SELECTED_INSERT\]|PERSONALIZE/);
    expect(result.output.contacts[0].emails.map((email) => email.step_label)).toEqual(['Step 1: Email · peer story', 'Step 4: Email · benchmarks / data']);
    expect(result.output.contacts[0].emails[0].body_text).toContain('washable silk');
    expect(result.output.contacts[0].emails[1].body_text).toContain('fit and sizing questions');
    expect(researchProvider.complexProduct).not.toHaveBeenCalled();
    expect(researchProvider.supportJobs).not.toHaveBeenCalled();
  });

  it('turns noisy public research into concise sales-rep personalization', async () => {
    const researchProvider = provider({
      accountResearch: vi.fn(async () => [{
        source_url: 'https://www.quince.com/',
        source_title: 'Quince',
        quote_or_fact: 'Quince sells apparel, clothing, cashmere sweaters, washable silk, and home goods online.',
        evidence_type: 'public_fact' as const,
        confidence: 'medium' as const,
      }]),
      heroProduct: vi.fn(async () => ({
        value: 'Quince | High Quality Essentials, Radically Low Prices --- Best Sellers ## Mongolian Cashmere Cardigan Sweater $79.90 4.9 +4 ## European Linen Sheet Set From $144.00 - Bundle and s',
        evidence_urls: ['https://www.quince.com/'],
      })),
      reviewPattern: vi.fn(async () => ({
        value: 'Genuinely I think quince is a scam. : r/quince Skip to main content Genuinely I think quince is a scam. : r/quince Go to quince r/quince 1mo ago',
        evidence_urls: ['https://www.reddit.com/r/quince/comments/example'],
      })),
    });

    const result = await runBdrPlayWorkflow({
      company: {
        company_name: 'Quince',
        domain: 'quince.com',
        contacts: [{ name: 'Jordan Lee', title: 'VP of Customer Experience', email: 'jordan@example.com' }],
      },
      researchProvider,
    });

    const bodyText = result.output.contacts[0].emails.map((email) => email.body_text).join('\n\n');
    expect(bodyText).toContain("{{first_name}}, Quince's cashmere sweaters and linen bedding can put fit, sizing, or product-comparison questions in the buying moment.");
    expect(bodyText).toContain('customers mention trust concerns in public reviews');
    expect(bodyText).not.toContain('High Quality Essentials, Radically Low Prices');
    expect(bodyText).not.toContain('Skip to main content');
    expect(bodyText).not.toContain('Go to quince');
  });

  it('turns noisy subscription pages into a natural subscription signal', async () => {
    const researchProvider = provider({
      accountResearch: vi.fn(async () => [{
        source_url: 'https://gruns.co/',
        source_title: 'Grüns',
        quote_or_fact: 'Grüns sells daily nutrition gummies, vitamins, supplements, and subscription packs for recurring wellness routines.',
        evidence_type: 'public_fact' as const,
        confidence: 'medium' as const,
      }]),
      subscriptionSignal: vi.fn(async () => ({
        value: 'Upgrade Your Subscription – Grüns Upgrade Your Subscription – Grüns ✨ Limited Time Sale ✨Save 52% + free shipping on...',
        evidence_urls: ['https://gruns.co/tools/recurring/portal'],
      })),
    });

    const result = await runBdrPlayWorkflow({
      company: {
        company_name: 'Grüns',
        domain: 'gruns.co',
        contacts: [{ name: 'Jillian Marin', title: 'Director of Retail Operations', email: 'jillian@example.com' }],
      },
      researchProvider,
    });

    expect(result.output.contacts[0].sequence_code).toBe('D-3');
    expect(result.output.contacts[0].emails[0].subject).toBe("how MaryRuth's monetized the cancel flow");
    expect(result.output.contacts[0].emails[0].body_text).toContain('The subscription upgrade flow at Grüns makes the save/cancel moment look like a revenue workflow');
    expect(result.output.contacts[0].emails[0].body_text).not.toContain('Upgrade Your Subscription');
    expect(result.output.contacts[0].play_metadata?.linkedin_note).toMatchObject({
      label: 'Step 2: LinkedIn · connection note',
    });
  });

  it('discovers BDR contact candidates when Cowork only supplies the company', async () => {
    const researchProvider = provider({
      accountResearch: vi.fn(async () => [{
        source_url: 'https://www.quince.com/',
        source_title: 'Quince',
        quote_or_fact: 'Quince sells apparel, clothing, cashmere sweaters, washable silk, and home goods online.',
        evidence_type: 'public_fact' as const,
        confidence: 'medium' as const,
      }]),
      heroProduct: vi.fn(async () => ({ value: 'washable silk collection', evidence_urls: ['https://www.quince.com/women/silk'] })),
      reviewPattern: vi.fn(async () => ({ value: 'fit and sizing questions show up in customer reviews', evidence_urls: ['https://example.com/quince-reviews'] })),
    });
    const contactDiscoveryProvider = vi.fn(async () => [{
      name: 'Jordan Lee',
      title: 'VP of Customer Experience',
      linkedin_url: 'https://linkedin.com/in/jordan-lee',
      evidence_url: 'https://linkedin.com/in/jordan-lee',
      evidence_title: 'Jordan Lee - VP of Customer Experience - Quince',
    }]);

    const result = await runBdrPlayWorkflow({
      company: { company_name: 'Quince', domain: 'quince.com' },
      researchProvider,
      contactDiscoveryProvider,
    });

    expect(contactDiscoveryProvider).toHaveBeenCalledWith({ company_name: 'Quince', domain: 'quince.com' });
    expect(result.sequence_plans[0].sequence_code).toBe('A-1');
    expect(result.output.contacts[0]).toMatchObject({
      email: expect.stringMatching(/@example\.invalid$/),
      first_name: 'Jordan',
      last_name: 'Lee',
      title: 'VP of Customer Experience',
      sequence_code: 'A-1',
    });
    expect(result.output.contacts[0].qa_warnings.join(' ')).toMatch(/discovered from public people search/);
    expect(result.output.contacts[0].qa_warnings.join(' ')).toMatch(/No verified contact email/);
    expect(result.output.contacts[0].emails[0].body_text).toContain('washable silk');
  });

  it('normalizes discovered LinkedIn titles embedded in the name field', async () => {
    const researchProvider = provider({
      accountResearch: vi.fn(async () => [{
        source_url: 'https://www.quince.com/',
        source_title: 'Quince',
        quote_or_fact: 'Quince sells apparel, clothing, cashmere sweaters, washable silk, and home goods online.',
        evidence_type: 'public_fact' as const,
        confidence: 'medium' as const,
      }]),
      heroProduct: vi.fn(async () => ({ value: 'washable silk collection', evidence_urls: ['https://www.quince.com/women/silk'] })),
      reviewPattern: vi.fn(async () => ({ value: 'fit and sizing questions show up in customer reviews', evidence_urls: ['https://example.com/quince-reviews'] })),
    });

    const result = await runBdrPlayWorkflow({
      company: { company_name: 'Quince', domain: 'quince.com' },
      researchProvider,
      contactDiscoveryProvider: async () => [{
        name: 'Jordan Lee | Building world class customer experience at Quince',
        evidence_url: 'https://linkedin.com/in/jordan-lee',
      }],
    });

    expect(result.output.contacts[0]).toMatchObject({
      first_name: 'Jordan',
      last_name: 'Lee',
      title: 'Building world class customer experience at Quince',
      sequence_code: 'A-1',
    });
    expect(result.output.contacts[0].qa_warnings.join(' ')).toMatch(/formal seniority/);
    expect(result.output.contacts[0].emails[0].body_text).toContain('washable silk');
  });

  it('rejects discovered people who do not explicitly match the company', async () => {
    const result = await runBdrPlayWorkflow({
      company: { company_name: 'Grüns', domain: 'gruns.co' },
      researchProvider: provider({
        accountResearch: vi.fn(async () => [{
          source_url: 'https://gruns.co/',
          source_title: 'Grüns',
          quote_or_fact: 'Grüns sells daily nutrition gummies, vitamins, supplements, and subscription packs.',
          evidence_type: 'public_fact' as const,
          confidence: 'medium' as const,
        }]),
      }),
      contactDiscoveryProvider: async () => [
        {
          name: 'Melissa Gooch',
          title: 'Director of Ecommerce Operations - Zale Brands at Signet Jewelers',
          evidence_url: 'https://linkedin.com/in/melissa-gooch',
          evidence_title: 'Melissa Gooch - Director of Ecommerce Operations - Signet Jewelers',
        },
        {
          name: 'Jillian Marin',
          title: 'Director of Retail Operations at Grüns',
          evidence_url: 'https://linkedin.com/in/jillian-marin',
          evidence_title: 'Jillian Marin - Director of Retail Operations at Grüns',
        },
      ],
    });

    expect(result.output.contacts).toHaveLength(1);
    expect(result.output.contacts[0]).toMatchObject({
      first_name: 'Jillian',
      last_name: 'Marin',
      sequence_code: 'D-3',
    });
  });
});
