import { describe, expect, it } from 'vitest';
import { buildBdrEvidenceDossier, researchFindingFromDossier } from '@/lib/plays/bdr/research-dossier';

const company = { company_name: 'Quince', domain: 'quince.com' };

describe('BDR research dossier', () => {
  it('prioritizes official product evidence and returns a compact insert', () => {
    const dossier = buildBdrEvidenceDossier({
      lookup: 'hero_product',
      company,
      fallbackWarning: 'No product signal found.',
      results: [
        {
          source_url: 'https://www.reddit.com/r/quince/comments/example',
          source_title: 'Quince discussion',
          quote_or_fact: 'Reddit thread about sizing.',
          evidence_type: 'public_fact',
          confidence: 'medium',
        },
        {
          source_url: 'https://www.quince.com/women/cashmere',
          source_title: 'Cashmere Collection',
          quote_or_fact: 'Mongolian Cashmere Cardigan Sweater with multiple size and color options.',
          evidence_type: 'public_fact',
          confidence: 'medium',
        },
      ],
    });

    expect(dossier.items[0]).toMatchObject({
      source_url: 'https://www.quince.com/women/cashmere',
      source_kind: 'product_pages',
      evidence_type: 'product',
    });
    const finding = researchFindingFromDossier({ company, dossier, fallbackWarning: 'No product signal found.' });
    expect(finding.insert).toMatchObject({
      selected_insert: expect.stringContaining("Quince's"),
      fallback_used: false,
      source_url: 'https://www.quince.com/women/cashmere',
    });
  });

  it('rejects review-pattern evidence when fewer than three credible examples exist', () => {
    const dossier = buildBdrEvidenceDossier({
      lookup: 'review_pattern',
      company,
      fallbackWarning: 'No repeated review pattern found; used Step 4 Version B.',
      results: [
        {
          source_url: 'https://www.reddit.com/r/quince/comments/example',
          source_title: 'One review thread',
          quote_or_fact: 'One complaint mentions fit.',
          evidence_type: 'public_fact',
          confidence: 'medium',
        },
      ],
    });
    const finding = researchFindingFromDossier({ company, dossier, fallbackWarning: 'No repeated review pattern found; used Step 4 Version B.' });

    expect(dossier.warnings.join(' ')).toMatch(/No repeated review pattern/);
    expect(finding).toMatchObject({
      warning: 'No repeated review pattern found; used Step 4 Version B.',
      insert: { fallback_used: true, confidence: 'low' },
    });
  });

  it('requires review evidence to repeat the same pattern before personalizing', () => {
    const dossier = buildBdrEvidenceDossier({
      lookup: 'review_pattern',
      company,
      fallbackWarning: 'No repeated review pattern found; used Step 4 Version B.',
      results: [
        {
          source_url: 'https://www.trustpilot.com/reviews/quince-1',
          source_title: 'Quince review',
          quote_or_fact: 'The sweater sizing felt inconsistent and I had to exchange it.',
          evidence_type: 'public_fact',
          confidence: 'medium',
        },
        {
          source_url: 'https://www.reddit.com/r/quince/comments/fit',
          source_title: 'Quince fit discussion',
          quote_or_fact: 'Several customers mention questions about fit before buying.',
          evidence_type: 'public_fact',
          confidence: 'medium',
        },
        {
          source_url: 'https://www.trustpilot.com/reviews/quince-2',
          source_title: 'Quince delivery review',
          quote_or_fact: 'Shipping took longer than expected during the holiday window.',
          evidence_type: 'public_fact',
          confidence: 'medium',
        },
      ],
    });
    const finding = researchFindingFromDossier({ company, dossier, fallbackWarning: 'No repeated review pattern found; used Step 4 Version B.' });

    expect(dossier.warnings.join(' ')).toMatch(/No repeated review pattern/);
    expect(finding.insert).toMatchObject({ fallback_used: true });
  });

  it('qualifies three credible review examples from the same pattern', () => {
    const dossier = buildBdrEvidenceDossier({
      lookup: 'review_pattern',
      company,
      fallbackWarning: 'No repeated review pattern found; used Step 4 Version B.',
      results: [
        {
          source_url: 'https://www.trustpilot.com/reviews/quince-1',
          source_title: 'Quince review',
          quote_or_fact: 'The sweater sizing felt inconsistent and I had to exchange it.',
          evidence_type: 'public_fact',
          confidence: 'medium',
        },
        {
          source_url: 'https://www.reddit.com/r/quince/comments/fit',
          source_title: 'Quince fit discussion',
          quote_or_fact: 'Several customers mention questions about fit before buying.',
          evidence_type: 'public_fact',
          confidence: 'medium',
        },
        {
          source_url: 'https://www.trustpilot.com/reviews/quince-2',
          source_title: 'Quince review',
          quote_or_fact: 'The pants run small, and size guidance was hard to trust.',
          evidence_type: 'public_fact',
          confidence: 'medium',
        },
      ],
    });
    const finding = researchFindingFromDossier({ company, dossier, fallbackWarning: 'No repeated review pattern found; used Step 4 Version B.' });

    expect(dossier.warnings).toEqual([]);
    expect(finding.insert).toMatchObject({
      selected_insert: 'customers mention fit and sizing questions in public reviews',
      fallback_used: false,
    });
  });

  it('prefers exact support role evidence over a generic careers page', () => {
    const dossier = buildBdrEvidenceDossier({
      lookup: 'support_jobs',
      company: { company_name: 'Rothy\'s', domain: 'rothys.com' },
      fallbackWarning: 'No support role count found; used Step 4 Version B.',
      results: [
        {
          source_url: 'https://rothys.com/careers',
          source_title: 'Careers at Rothy\'s',
          quote_or_fact: 'Browse open roles and learn about the team.',
          evidence_type: 'public_fact',
          confidence: 'medium',
        },
        {
          source_url: 'https://rothys.com/careers/customer-care-manager',
          source_title: 'Customer Care Manager',
          quote_or_fact: 'Customer Care Manager owns routing, escalations, and support coverage for ecommerce customers.',
          evidence_type: 'public_fact',
          confidence: 'medium',
        },
      ],
    });

    expect(dossier.items[0]).toMatchObject({
      source_url: 'https://rothys.com/careers/customer-care-manager',
      evidence_type: 'jobs',
    });
    expect(dossier.items[0].ranking_rationale).toMatch(/specific/i);
  });

  it('prefers subscription help-center evidence over a generic official page', () => {
    const dossier = buildBdrEvidenceDossier({
      lookup: 'subscription_signal',
      company: { company_name: 'Gruns', domain: 'gruns.co' },
      fallbackWarning: 'No subscription signal found.',
      results: [
        {
          source_url: 'https://gruns.co/',
          source_title: 'Gruns',
          quote_or_fact: 'Gruns sells daily nutrition packs online.',
          evidence_type: 'public_fact',
          confidence: 'medium',
        },
        {
          source_url: 'https://gruns.co/tools/recurring/portal',
          source_title: 'Upgrade Your Subscription',
          quote_or_fact: 'Upgrade your subscription, skip a shipment, or manage recurring daily nutrition packs.',
          evidence_type: 'public_fact',
          confidence: 'medium',
        },
      ],
    });

    expect(dossier.items[0]).toMatchObject({
      source_url: 'https://gruns.co/tools/recurring/portal',
      source_kind: 'help_center',
      evidence_type: 'help_center',
    });
    expect(dossier.warnings).toEqual([]);
  });

  it('deduplicates repeated source snippets before sending evidence onward', () => {
    const dossier = buildBdrEvidenceDossier({
      lookup: 'subscription_signal',
      company: { company_name: 'Gruns', domain: 'gruns.co' },
      fallbackWarning: 'No subscription signal found.',
      results: [
        {
          source_url: 'https://gruns.co/tools/recurring/portal',
          source_title: 'Upgrade Your Subscription',
          quote_or_fact: 'Upgrade your subscription and manage recurring daily nutrition packs.',
          evidence_type: 'public_fact',
          confidence: 'medium',
        },
        {
          source_url: 'https://gruns.co/tools/recurring/portal',
          source_title: 'Upgrade Your Subscription',
          quote_or_fact: 'Upgrade your subscription and manage recurring daily nutrition packs.',
          evidence_type: 'public_fact',
          confidence: 'medium',
        },
      ],
    });

    expect(dossier.items).toHaveLength(1);
    expect(dossier.warnings).toEqual([]);
  });
});
