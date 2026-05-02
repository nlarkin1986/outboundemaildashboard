import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBdrSequencePlans } from '@/lib/plays/bdr/sequence-plan';
import { researchBdrPlaceholders } from '@/lib/plays/bdr/placeholder-research';
import { defaultBdrResearchProvider, type BdrResearchProvider } from '@/lib/plays/bdr/research';

const generateTextMock = vi.hoisted(() => vi.fn());

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return { ...actual, generateText: generateTextMock };
});

vi.mock('@ai-sdk/anthropic', () => ({
  anthropic: vi.fn(() => ({ provider: 'mock-anthropic', modelId: 'mock-model' })),
}));

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
  afterEach(() => {
    vi.unstubAllEnvs();
    generateTextMock.mockReset();
    vi.restoreAllMocks();
  });

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

  it('starts Step 1 and Step 4 placeholder lookups concurrently', async () => {
    let resolveHeroProduct: (value: Awaited<ReturnType<BdrResearchProvider['heroProduct']>>) => void;
    const calls: string[] = [];
    const researchProvider = provider({
      heroProduct: vi.fn(() => new Promise<Awaited<ReturnType<BdrResearchProvider['heroProduct']>>>((resolve) => {
        calls.push('hero_product');
        resolveHeroProduct = resolve;
      })),
      reviewPattern: vi.fn(async () => {
        calls.push('review_pattern');
        return { value: 'sizing questions appear in negative reviews', evidence_urls: ['https://example.com/reviews'] };
      }),
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

    const resultPromise = researchBdrPlaceholders({
      company: { company_name: 'Kizik', domain: 'kizik.com' },
      plan: plans[0],
      researchProvider,
      useSynthesisAgent: false,
    });

    await vi.waitFor(() => expect(researchProvider.reviewPattern).toHaveBeenCalledTimes(1));
    expect(calls).toEqual(['hero_product', 'review_pattern']);
    resolveHeroProduct!({ value: 'Prague hands-free sneaker', evidence_urls: ['https://example.com/product'] });
    await expect(resultPromise).resolves.toMatchObject({ sequence_code: 'A-1' });
  });

  it('falls back to deterministic inserts when structured synthesis rejects', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
    generateTextMock.mockRejectedValueOnce(new Error('provider unavailable'));
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
      useSynthesisAgent: true,
    });

    expect(result?.step1.insert?.selected_insert).toContain('Prague hands-free sneaker');
    expect(result?.warnings.join(' ')).toMatch(/BDR synthesis agent failed.*provider unavailable/);
  });

  it('falls back to deterministic inserts when structured synthesis times out', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
    vi.stubEnv('BDR_RESEARCH_AGENT_TIMEOUT_MS', '1');
    generateTextMock.mockImplementationOnce(() => new Promise(() => undefined));
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
      useSynthesisAgent: true,
    });

    expect(result?.step4.insert?.selected_insert).toContain('customers mention fit and sizing questions');
    expect(result?.warnings.join(' ')).toMatch(/timed out/);
  });

  it('falls back to deterministic inserts when structured synthesis output is invalid', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
    generateTextMock.mockResolvedValueOnce({ output: { step1: null, step4: null, warnings: [] } });
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
      useSynthesisAgent: true,
    });

    expect(result?.step1.insert?.selected_insert).toContain('Prague hands-free sneaker');
    expect(result?.warnings.join(' ')).toMatch(/BDR synthesis agent failed/);
  });

  it('uses Firecrawl extraction to enrich a promising official product result', async () => {
    vi.stubEnv('EXA_API_KEY', 'exa-test');
    vi.stubEnv('FIRECRAWL_API_KEY', 'fc-test');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('api.exa.ai')) {
        return new Response(JSON.stringify({
          results: [{
            url: 'https://kizik.com/products/prague',
            title: 'Prague Hands-Free Sneaker',
            text: 'Prague is a hands-free sneaker.',
          }],
        }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (url.includes('api.firecrawl.dev')) {
        return new Response(JSON.stringify({
          success: true,
          data: {
            markdown: '# Prague Hands-Free Sneaker\nHands-free sneaker with wide sizing guidance, easy returns, and fit details for online shoppers.',
            metadata: { title: 'Prague Hands-Free Sneaker', sourceURL: 'https://kizik.com/products/prague' },
          },
        }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    const result = await defaultBdrResearchProvider.heroProduct({ company_name: 'Kizik', domain: 'kizik.com' });

    expect(fetchSpy).toHaveBeenCalledWith('https://api.firecrawl.dev/v2/scrape', expect.objectContaining({ method: 'POST' }));
    expect(result.insert).toMatchObject({
      selected_insert: expect.stringContaining("Kizik's Prague Hands-Free Sneaker"),
      source_snippet: expect.stringContaining('wide sizing guidance'),
      fallback_used: false,
    });
  });
});
