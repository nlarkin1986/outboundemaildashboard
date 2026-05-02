import { afterEach, describe, expect, it, vi } from 'vitest';
import { scrapeWithFirecrawl, searchPublicWeb } from '@/lib/ai/tools';

describe('research tools', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('skips Firecrawl scrape when the API key is not configured', async () => {
    vi.stubEnv('FIRECRAWL_API_KEY', '');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await expect(scrapeWithFirecrawl('https://example.com')).resolves.toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('scrapes pages through Firecrawl and returns normalized research evidence', async () => {
    vi.stubEnv('FIRECRAWL_API_KEY', 'fc-test');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      success: true,
      data: {
        markdown: '# Product page\nA featured collection with detailed sizing guidance.',
        metadata: {
          title: 'Featured Collection',
          sourceURL: 'https://example.com/collection',
        },
      },
    }), { status: 200, headers: { 'content-type': 'application/json' } }));

    const result = await scrapeWithFirecrawl('https://example.com/collection');

    expect(fetchSpy).toHaveBeenCalledWith('https://api.firecrawl.dev/v2/scrape', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ authorization: 'Bearer fc-test' }),
    }));
    expect(JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string)).toMatchObject({
      url: 'https://example.com/collection',
      formats: ['markdown'],
      onlyMainContent: true,
      proxy: 'auto',
    });
    expect(result[0]).toMatchObject({
      source_url: 'https://example.com/collection',
      source_title: 'Featured Collection',
      quote_or_fact: expect.stringContaining('featured collection'),
      evidence_type: 'public_fact',
      confidence: 'medium',
    });
  });

  it('passes bounded domain-scoped queries to Exa search', async () => {
    vi.stubEnv('EXA_API_KEY', 'exa-test');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      results: [{
        url: 'https://kizik.com/products/prague',
        title: 'Prague Hands-Free Sneaker',
        text: 'Hands-free sneaker with sizing guidance.',
      }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }));

    const result = await searchPublicWeb('Kizik Prague hands-free sneaker sizing', 'kizik.com', 2);

    expect(fetchSpy).toHaveBeenCalledWith('https://api.exa.ai/search', expect.objectContaining({ method: 'POST' }));
    expect(JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string)).toMatchObject({
      query: 'Kizik Prague hands-free sneaker sizing',
      numResults: 2,
      includeDomains: ['kizik.com'],
      contents: { text: { maxCharacters: 1200 } },
    });
    expect(result).toHaveLength(1);
  });
});
