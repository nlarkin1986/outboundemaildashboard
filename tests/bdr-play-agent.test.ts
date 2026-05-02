import { describe, expect, it, vi } from 'vitest';
import { runBdrPlayAgent } from '@/lib/plays/bdr/run-bdr-play-agent';
import { bdrInsertSynthesisPrompt, bdrResearchAgentPrompt, normalizeBdrSynthesisFinding } from '@/lib/plays/bdr/research-agent';
import { sequenceFor } from '@/lib/plays/bdr/sequences';
import type { BdrResearchFinding, BdrResearchProvider } from '@/lib/plays/bdr/research';

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

function finding(overrides: Partial<BdrResearchFinding> = {}): BdrResearchFinding {
  return {
    value: "Kizik's Prague hands-free sneaker can put fit and sizing questions in the buying moment",
    evidence_urls: ['https://kizik.com/products/prague'],
    insert: {
      selected_insert: "Kizik's Prague hands-free sneaker can put fit and sizing questions in the buying moment",
      confidence: 'high',
      evidence_type: 'product',
      verified_fact: 'Prague hands-free sneaker has sizing guidance.',
      source_url: 'https://kizik.com/products/prague',
      source_snippet: 'Prague hands-free sneaker has sizing guidance.',
      fallback_used: false,
      qualification_rationale: 'official-domain product page; high specificity',
    },
    ...overrides,
  };
}

describe('BDR play agent', () => {
  it('builds a bounded research prompt from only the selected sequence slices', () => {
    const prompt = bdrResearchAgentPrompt({
      company: { company_name: 'Quince', domain: 'quince.com' },
      sequence: sequenceFor('A-1'),
    });
    const serialized = JSON.stringify(prompt);

    expect(prompt.sequence).toMatchObject({
      code: 'A-1',
      step1: { lookup: 'hero_product' },
      step4: { lookup: 'review_pattern' },
    });
    expect(serialized).toContain('prompt_pack_revision');
    expect(serialized).toContain('selected_insert');
    expect(serialized).not.toContain('MaryRuth');
    expect(serialized).not.toContain('Ralph Lauren');
    expect(serialized).not.toMatch(/\[SELECTED_INSERT\]|PERSONALIZE/);
  });

  it('builds a bounded synthesis prompt around dossier evidence without unrelated templates', () => {
    const prompt = bdrInsertSynthesisPrompt({
      company: { company_name: 'Kizik', domain: 'kizik.com' },
      sequence: sequenceFor('A-1'),
      research: {
        step1: finding(),
        step4: finding({
          value: 'customers mention fit and sizing questions in public reviews',
          evidence_urls: ['https://www.trustpilot.com/reviews/kizik-1'],
          insert: {
            selected_insert: 'customers mention fit and sizing questions in public reviews',
            confidence: 'high',
            evidence_type: 'reviews',
            verified_fact: 'Three reviews mention fit and sizing.',
            source_url: 'https://www.trustpilot.com/reviews/kizik-1',
            source_snippet: 'Three reviews mention fit and sizing.',
            fallback_used: false,
          },
        }),
      },
    });
    const serialized = JSON.stringify(prompt);

    expect(prompt.output_contract.allowed_evidence_urls.step1).toEqual(['https://kizik.com/products/prague']);
    expect(serialized).toContain('compact_dossier');
    expect(serialized).toContain('Prague hands-free sneaker has sizing guidance');
    expect(serialized).not.toContain('MaryRuth');
    expect(serialized).not.toContain('Ralph Lauren');
    expect(serialized).not.toMatch(/\[SELECTED_INSERT\]|PERSONALIZE/i);
  });

  it('rejects synthesized inserts that cite evidence outside the dossier', () => {
    const result = normalizeBdrSynthesisFinding({
      lookup: 'hero_product',
      finding: finding(),
      output: {
        value: 'unsupported insert',
        evidence_urls: ['https://example.com/unsupported'],
        insert: {
          selected_insert: 'Unsupported product claim can create buying questions',
          confidence: 'high',
          evidence_type: 'product',
          verified_fact: 'Unsupported product claim.',
          source_url: 'https://example.com/unsupported',
          fallback_used: false,
        },
      },
    });

    expect(result.insert).toMatchObject({
      fallback_used: true,
      warning: expect.stringMatching(/outside the dossier/),
    });
  });

  it('rejects synthesized inserts that contain research-process language', () => {
    const result = normalizeBdrSynthesisFinding({
      lookup: 'hero_product',
      finding: finding(),
      output: {
        value: 'I noticed Kizik has a new sneaker',
        evidence_urls: ['https://kizik.com/products/prague'],
        insert: {
          selected_insert: 'I noticed Kizik has a new sneaker that can create sizing questions',
          confidence: 'high',
          evidence_type: 'product',
          verified_fact: 'Prague hands-free sneaker has sizing guidance.',
          source_url: 'https://kizik.com/products/prague',
          fallback_used: false,
        },
      },
    });

    expect(result.insert).toMatchObject({
      fallback_used: true,
      warning: expect.stringMatching(/research-process language/),
    });
  });

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
    expect(output.contacts[0].play_metadata).toMatchObject({ draft_generation_blocked: true });
    expect(output.contacts[0].emails[0].subject).toBe('BDR sequence unavailable');
    expect(output.contacts[0].emails[0].body_text).not.toMatch(/confirm the right BDR sequence|{{first_name}}/);
    expect(output.contacts[0].qa_warnings.join(' ')).toMatch(/Unsupported persona/);
  });
});
