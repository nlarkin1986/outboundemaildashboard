import { describe, expect, it } from 'vitest';
import { classifyPersona, selectBdrSequence } from '@/lib/plays/bdr/classify';
import { BDR_SEQUENCES } from '@/lib/plays/bdr/sequences';

describe('BDR play classification', () => {
  it('maps VP customer experience at a high-return brand to A-1', () => {
    const selection = selectBdrSequence({ company_name: 'Kizik', domain: 'kizik.com' }, 'VP of Customer Experience');

    expect(selection.brand.code).toBe('A');
    expect(selection.persona.code).toBe('1');
    expect(selection.sequence_code).toBe('A-1');
    expect(selection.warnings).toEqual([]);
  });

  it('maps ecommerce leaders at high-consideration electronics brands to D-2', () => {
    const selection = selectBdrSequence({ company_name: 'LG Electronics', domain: 'lg.com' }, 'Director of E-commerce');

    expect(selection.brand.code).toBe('B');
    expect(selection.persona.code).toBe('D');
    expect(selection.sequence_code).toBe('D-2');
  });

  it('defaults ambiguous digital titles to persona 3 with a warning', () => {
    const persona = classifyPersona('VP of Digital');

    expect(persona.code).toBe('3');
    expect(persona.warning).toMatch(/sanity-check/i);
  });

  it('flags unsupported personas instead of forcing a sequence', () => {
    const selection = selectBdrSequence({ company_name: 'Kizik', domain: 'kizik.com' }, 'Chief Marketing Officer');

    expect(selection.sequence_code).toBeUndefined();
    expect(selection.warnings.join(' ')).toMatch(/unsupported persona/i);
  });

  it('flags unsupported brand categories', () => {
    const selection = selectBdrSequence({ company_name: 'Acme Bank', domain: 'acmebank.com' }, 'VP of Customer Experience');

    expect(selection.sequence_code).toBeUndefined();
    expect(selection.warnings.join(' ')).toMatch(/unsupported brand category/i);
  });

  it('preserves required Outreach merge tokens in sequence templates', () => {
    for (const sequence of Object.values(BDR_SEQUENCES)) {
      const allCopy = `${sequence.step1.body} ${sequence.step1.fallback_body ?? ''} ${sequence.step4.version_a?.body ?? ''} ${sequence.step4.version_b.body}`;
      expect(allCopy).toContain('{{first_name}}');
      expect(allCopy).toContain('{{sender.first_name}}');
    }
  });
});
