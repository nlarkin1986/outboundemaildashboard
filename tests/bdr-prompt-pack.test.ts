import { describe, expect, it } from 'vitest';
import { allBdrPromptPackSlices, BDR_PROMPT_PACK_REVISION, bdrPromptPackSlice, bdrPromptPackSlices } from '@/lib/plays/bdr/prompt-pack';
import { BDR_SEQUENCES } from '@/lib/plays/bdr/sequences';
import type { BdrSequenceCode } from '@/lib/plays/bdr/types';

describe('BDR prompt pack runtime slices', () => {
  it('covers Step 1 and Step 4 for every BDR sequence', () => {
    const slices = allBdrPromptPackSlices();

    expect(slices).toHaveLength(Object.keys(BDR_SEQUENCES).length * 2);
    for (const code of Object.keys(BDR_SEQUENCES) as BdrSequenceCode[]) {
      expect(bdrPromptPackSlices(code).map((slice) => slice.original_step_number)).toEqual([1, 4]);
      expect(bdrPromptPackSlices(code).map((slice) => slice.prompt_pack_revision)).toEqual([
        BDR_PROMPT_PACK_REVISION,
        BDR_PROMPT_PACK_REVISION,
      ]);
    }
  });

  it('exposes only selected A-1 lookup instructions with thresholds and source priorities', () => {
    const [step1, step4] = bdrPromptPackSlices('A-1');

    expect(step1).toMatchObject({
      sequence_code: 'A-1',
      original_step_number: 1,
      lookup: 'hero_product',
      source_priority: ['official_site', 'product_pages', 'social', 'browser_fallback'],
      evidence_threshold: { allow_fallback: true },
    });
    expect(step4).toMatchObject({
      sequence_code: 'A-1',
      original_step_number: 4,
      lookup: 'review_pattern',
      source_priority: ['reviews', 'social'],
      evidence_threshold: { min_similar_review_examples: 3, allow_fallback: true },
    });
    expect(step4.fallback_rule).toMatch(/at least three/i);
  });

  it('keeps ecommerce persona language constraints separate from prompt prose', () => {
    const step1 = bdrPromptPackSlice('D-3', 1);

    expect(step1.language_constraints).toMatchObject({
      audience: 'ecommerce',
      preferred_terms: expect.arrayContaining(['repeat purchase rate', 'customer LTV']),
      disallowed_terms: expect.arrayContaining(['CSAT', 'agents', 'tickets', 'support queue']),
    });
    expect(step1.instruction).toMatch(/subscription retention/i);
    expect(step1.output_contract).toEqual(expect.arrayContaining(['selected_insert', 'fallback_used', 'source_snippet']));
  });

  it('does not expose unrelated sequence bodies or markdown prompt artifacts at runtime', () => {
    const serialized = JSON.stringify(bdrPromptPackSlices('B-2'));

    expect(serialized).not.toMatch(/\[SELECTED_INSERT\]|PERSONALIZE|^\\| SEQUENCE/);
    expect(serialized).not.toContain("MaryRuth's monetized");
    expect(serialized).not.toContain("Rothy's figured out");
  });
});
