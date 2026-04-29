import { describe, expect, it } from 'vitest';
import { normalizeBatchReviewStateForEditing, normalizeReviewStateForEditing } from '@/lib/review-editor-state';
import type { BatchReviewState, ReviewState } from '@/lib/types';

const reviewState: ReviewState = {
  run: {
    id: 'run_1',
    company_name: 'Example',
    status: 'ready_for_review',
    mode: 'fast',
    source: 'manual',
    review_token: 'token',
    created_at: 'now',
    updated_at: 'now',
  },
  contacts: [{
    id: 'contact_1',
    run_id: 'run_1',
    email: 'jamie@example.com',
    status: 'needs_edit',
    evidence_urls: [],
    qa_warnings: [],
    emails: [{
      id: 'email_1',
      contact_id: 'contact_1',
      step_number: 1,
      subject: 'hello',
      body_html: '<p>Hi Jamie,</p><p>Second paragraph</p>',
      body_text: 'Hi Jamie, Second paragraph',
      original_subject: 'hello',
      original_body_html: '<p>Hi Jamie,</p><p>Second paragraph</p>',
    }],
  }],
};

describe('review editor state normalization', () => {
  it('seeds the editable body text from html paragraph formatting instead of stripped body_text', () => {
    const normalized = normalizeReviewStateForEditing(reviewState);

    expect(normalized.contacts[0].emails[0].body_text).toBe('Hi Jamie,\n\nSecond paragraph');
  });

  it('normalizes batch review nested email bodies the same way', () => {
    const batchState: BatchReviewState = {
      batch: {
        id: 'batch_1',
        source: 'manual',
        status: 'ready_for_review',
        mode: 'fast',
        review_token: 'batch_token',
        created_at: 'now',
        updated_at: 'now',
      },
      runs: [{
        batch_id: 'batch_1',
        run_id: 'run_1',
        company_name: 'Example',
        status: 'ready_for_review',
        created_at: 'now',
        updated_at: 'now',
        review: reviewState,
      }],
    };

    const normalized = normalizeBatchReviewStateForEditing(batchState);

    expect(normalized.runs[0].review.contacts[0].emails[0].body_text).toBe('Hi Jamie,\n\nSecond paragraph');
  });
});
