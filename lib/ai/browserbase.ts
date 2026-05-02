import type { ResearchResult } from './tools';

export type BrowserbaseExtractionResult = {
  results: ResearchResult[];
  warning?: string;
};

export async function extractWithBrowserbase(url: string): Promise<BrowserbaseExtractionResult> {
  if (!process.env.BROWSERBASE_API_KEY) {
    return {
      results: [],
      warning: 'BROWSERBASE_API_KEY is not configured; skipped Browserbase fallback extraction.',
    };
  }

  return {
    results: [],
    warning: `Browserbase fallback extraction is not installed for ${url}; used static research fallback.`,
  };
}
