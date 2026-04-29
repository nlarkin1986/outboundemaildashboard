import { beforeEach, describe, expect, it } from 'vitest';
import { createBatch, getBatchReviewByToken, resetStore, saveBatchReviewState, submitBatchReview } from '@/lib/store';
import { processBatch } from '@/lib/jobs/processBatch';

describe('batch review flow', () => {
  beforeEach(() => resetStore());

  it('creates company-only drafts with non-pushable contact warnings', async () => {
    const batch = await createBatch({
      requested_by: 'nate@example.com',
      cowork_thread_id: 'cowork-thread-123',
      campaign_id: 'campaign-1',
      companies: [{ company_name: 'Kizik', domain: 'kizik.com' }],
    });

    const processed = await processBatch(batch.id);
    expect(processed.status).toBe('ready_for_review');

    const state = await getBatchReviewByToken(batch.review_token);
    expect(state.runs).toHaveLength(1);
    expect(state.runs[0].review.contacts[0].email).toContain('@example.invalid');
    expect(state.runs[0].review.contacts[0].qa_warnings.join(' ')).toMatch(/No contacts supplied/);

    state.runs[0].review.contacts[0].status = 'approved';
    await expect(submitBatchReview(batch.review_token)).rejects.toThrow(/real email/);
  });

  it('saves edits and queues only approved supplied contacts on submit', async () => {
    const batch = await createBatch({
      requested_by: 'nate@example.com',
      cowork_thread_id: 'cowork-thread-123',
      campaign_id: 'campaign-1',
      companies: [{
        company_name: 'The Black Tux',
        domain: 'theblacktux.com',
        contacts: [
          { first_name: 'Alex', last_name: 'Morgan', title: 'VP CX', company: 'The Black Tux', email: 'alex@example.com' },
          { first_name: 'Sam', last_name: 'Lee', title: 'Director Support', company: 'The Black Tux', email: 'sam@example.com' },
        ],
      }],
    });
    await processBatch(batch.id);
    const state = await getBatchReviewByToken(batch.review_token);
    const run = state.runs[0];
    const [approved, skipped] = run.review.contacts;
    approved.status = 'approved';
    skipped.status = 'skipped';
    approved.emails[0].subject = 'edited subject';

    await saveBatchReviewState(batch.review_token, { runs: [{ run_id: run.run_id, contacts: [approved, skipped] }] }, 'reviewer@example.com');
    const saved = await getBatchReviewByToken(batch.review_token);
    expect(saved.runs[0].review.contacts.find((c) => c.email === approved.email)?.emails[0].subject).toBe('edited subject');

    const submitted = await submitBatchReview(batch.review_token, 'reviewer@example.com');
    expect(submitted.approved_contacts).toBe(1);
    expect(submitted.status).toBe('review_submitted');
  });
});
