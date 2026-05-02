import { afterEach, describe, expect, it, vi } from 'vitest';
import { extractWithBrowserbase } from '@/lib/ai/browserbase';

describe('Browserbase fallback boundary', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns a warning instead of failing when Browserbase is not configured', async () => {
    vi.stubEnv('BROWSERBASE_API_KEY', '');

    await expect(extractWithBrowserbase('https://example.com/catalog')).resolves.toMatchObject({
      results: [],
      warning: expect.stringContaining('BROWSERBASE_API_KEY is not configured'),
    });
  });

  it('is fail-closed while the optional Browserbase runtime is not installed', async () => {
    vi.stubEnv('BROWSERBASE_API_KEY', 'bb-test');

    await expect(extractWithBrowserbase('https://example.com/catalog')).resolves.toMatchObject({
      results: [],
      warning: expect.stringContaining('not installed'),
    });
  });
});
