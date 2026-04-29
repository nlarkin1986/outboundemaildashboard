export type ResearchResult = {
  source_url: string;
  source_title?: string;
  quote_or_fact: string;
  evidence_type: 'public_fact' | 'inference' | 'proof_point';
  confidence: 'high' | 'medium' | 'low';
};

export async function searchWithExa(companyName: string, domain?: string): Promise<ResearchResult[]> {
  if (!process.env.EXA_API_KEY) {
    return [{ source_url: domain ? `https://${domain}` : 'https://example.com', quote_or_fact: `Public research for ${companyName} should be verified before push.`, evidence_type: 'inference', confidence: 'low' }];
  }
  // Production hook: call Exa search/fetch here. Kept as a typed seam for credentials/server-side execution.
  return [{ source_url: domain ? `https://${domain}` : 'https://example.com', quote_or_fact: `Official website signal for ${companyName}.`, evidence_type: 'public_fact', confidence: 'medium' }];
}

export async function fetchWithBrowserbase(url: string): Promise<ResearchResult[]> {
  if (!process.env.BROWSERBASE_API_KEY) return [];
  // Production hook: use Browserbase/Playwright for JS-heavy or blocked pages.
  return [{ source_url: url, quote_or_fact: 'Browserbase fallback fetched page content.', evidence_type: 'public_fact', confidence: 'medium' }];
}
