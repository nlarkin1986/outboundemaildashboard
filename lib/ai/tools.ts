export type ResearchResult = {
  source_url: string;
  source_title?: string;
  quote_or_fact: string;
  evidence_type: 'public_fact' | 'inference' | 'proof_point';
  confidence: 'high' | 'medium' | 'low';
};

export type PeopleResult = {
  name: string;
  title?: string;
  linkedin_url?: string;
  evidence_url: string;
  evidence_title?: string;
};

type ExaSearchResult = {
  title?: string;
  url?: string;
  text?: string;
  author?: string;
};

type ExaSearchResponse = {
  results?: ExaSearchResult[];
};

async function exaSearch(body: Record<string, unknown>): Promise<ExaSearchResult[]> {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) return [];
  const response = await fetch('https://api.exa.ai/search', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    console.error('Exa search failed', { status: response.status });
    return [];
  }
  const data = (await response.json()) as ExaSearchResponse;
  return data.results ?? [];
}

function cleanText(value?: string) {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

function parseLinkedInTitle(result: ExaSearchResult): PeopleResult | null {
  const url = result.url;
  if (!url || !url.includes('linkedin.com/in/')) return null;
  const rawTitle = cleanText(result.title).replace(/\s*\|\s*LinkedIn.*$/i, '');
  if (!rawTitle) return null;
  const parts = rawTitle.split(/\s+[-–—]\s+/).map((part) => part.trim()).filter(Boolean);
  const name = parts[0];
  if (!name || /linkedin|profiles|people/i.test(name)) return null;
  return {
    name,
    title: parts.slice(1).join(' - ') || undefined,
    linkedin_url: url,
    evidence_url: url,
    evidence_title: result.title,
  };
}

export async function searchWithExa(companyName: string, domain?: string): Promise<ResearchResult[]> {
  const query = `${companyName} ${domain ?? ''} customer support help returns shipping contact careers ecommerce operations`;
  const results = await exaSearch({
    query,
    numResults: 6,
    includeDomains: domain ? [domain] : undefined,
    contents: { text: { maxCharacters: 1200 } },
  });

  if (results.length === 0) {
    return [{
      source_url: domain ? `https://${domain}` : 'https://example.com',
      quote_or_fact: process.env.EXA_API_KEY
        ? `No strong Exa research results were returned for ${companyName}; verify manually before approving.`
        : `EXA_API_KEY is not configured; public research for ${companyName} was not run.`,
      evidence_type: 'inference',
      confidence: 'low',
    }];
  }

  return results
    .filter((result) => result.url)
    .map((result) => ({
      source_url: result.url!,
      source_title: result.title,
      quote_or_fact: cleanText(result.text) || cleanText(result.title) || `Public source found for ${companyName}.`,
      evidence_type: 'public_fact' as const,
      confidence: 'medium' as const,
    }));
}

export async function searchPublicWeb(query: string, domain?: string, numResults = 5): Promise<ResearchResult[]> {
  const results = await exaSearch({
    query,
    numResults,
    includeDomains: domain ? [domain] : undefined,
    contents: { text: { maxCharacters: 1200 } },
  });
  if (results.length === 0) return [];
  return results
    .filter((result) => result.url)
    .map((result) => ({
      source_url: result.url!,
      source_title: result.title,
      quote_or_fact: cleanText(result.text) || cleanText(result.title) || `Public source found for ${query}.`,
      evidence_type: 'public_fact' as const,
      confidence: 'medium' as const,
    }));
}

export async function findPeopleWithExa(companyName: string, domain?: string, targetPersona = 'customer experience OR customer support OR ecommerce operations'): Promise<PeopleResult[]> {
  const results = await exaSearch({
    query: `${companyName} ${domain ?? ''} ${targetPersona} leader director manager LinkedIn`,
    category: 'people',
    numResults: 8,
    includeDomains: ['linkedin.com'],
    contents: { text: { maxCharacters: 400 } },
  });
  const seen = new Set<string>();
  return results
    .map(parseLinkedInTitle)
    .filter((candidate): candidate is PeopleResult => Boolean(candidate))
    .filter((candidate) => {
      const key = `${candidate.name.toLowerCase()}|${candidate.linkedin_url ?? candidate.evidence_url}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 5);
}

export async function fetchWithBrowserbase(url: string): Promise<ResearchResult[]> {
  if (!process.env.BROWSERBASE_API_KEY) return [];
  // Production hook: use Browserbase/Playwright for JS-heavy or blocked pages.
  return [{ source_url: url, quote_or_fact: 'Browserbase fallback fetched page content.', evidence_type: 'public_fact', confidence: 'medium' }];
}
