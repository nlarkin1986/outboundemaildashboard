import { beforeEach, describe, expect, it } from 'vitest';
import { attachRunToBatch, createBatch, createRun, getBatchReviewByToken, pushApprovedContactsForBatch, resetStore, saveBatchReviewState, submitBatchReview } from '@/lib/store';
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
      actor: { email: 'nate@example.com' },
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

    const finalState = await getBatchReviewByToken(batch.review_token);
    expect(finalState.batch.account_id).toBe(batch.account_id);
    expect(finalState.batch.created_by_user_id).toBe(batch.created_by_user_id);
    expect(finalState.runs[0].review.run.account_id).toBe(batch.account_id);
    expect(finalState.runs[0].review.run.created_by_user_id).toBe(batch.created_by_user_id);
  });

  it('does not create duplicate runs when processing is retried after success', async () => {
    const batch = await createBatch({
      actor: { email: 'nate@example.com' },
      cowork_thread_id: 'cowork-thread-123',
      campaign_id: 'campaign-1',
      companies: [{ company_name: 'Quince', domain: 'onequince.com' }],
    });

    await processBatch(batch.id);
    await processBatch(batch.id);

    const state = await getBatchReviewByToken(batch.review_token);
    expect(state.runs).toHaveLength(1);
    expect(state.runs[0].company_key).toBe('domain:onequince.com');
    expect(state.runs[0].status).toBe('ready_for_review');
  });

  it('does not mark a retry ready when an existing run is still in progress', async () => {
    const batch = await createBatch({
      actor: { email: 'nate@example.com' },
      cowork_thread_id: 'cowork-thread-123',
      campaign_id: 'campaign-1',
      companies: [{ company_name: 'Quince', domain: 'onequince.com' }],
    });
    const run = await createRun({
      company_name: 'Quince',
      domain: 'onequince.com',
      contacts: [{ email: 'alex@example.com', first_name: 'Alex', last_name: 'Morgan' }],
      mode: 'fast',
      source: 'cowork',
    });
    await attachRunToBatch(batch.id, run.id, { company_name: 'Quince', domain: 'onequince.com' }, 'researching');

    const processed = await processBatch(batch.id);
    const state = await getBatchReviewByToken(batch.review_token);

    expect(processed.status).toBe('processing');
    expect(state.batch.status).toBe('processing');
    expect(state.runs).toHaveLength(1);
    expect(state.runs[0].status).toBe('researching');
  });

  it('processes BDR play batches with Step 1 and Step 4 review labels', async () => {
    const batch = await createBatch({
      actor: { email: 'nate@example.com' },
      cowork_thread_id: 'cowork-thread-123',
      campaign_id: 'campaign-1',
      play_id: 'bdr_cold_outbound',
      companies: [{
        company_name: 'Kizik',
        domain: 'kizik.com',
        contacts: [{ first_name: 'Alex', last_name: 'Morgan', title: 'VP of Customer Experience', email: 'alex@example.com' }],
      }],
    });

    await processBatch(batch.id);
    const state = await getBatchReviewByToken(batch.review_token);
    const contact = state.runs[0].review.contacts[0];

    expect(state.batch.play_id).toBe('bdr_cold_outbound');
    expect(state.runs[0].review.run.play_id).toBe('bdr_cold_outbound');
    expect(contact.sequence_code).toBe('A-1');
    expect(contact.emails).toHaveLength(2);
    expect(contact.emails.map((email) => email.original_step_number)).toEqual([1, 4]);
    expect(contact.emails.map((email) => email.step_label)).toEqual(['Step 1: Email · peer story', 'Step 4: Email · benchmarks / data']);
  });

  it('pushes BDR reviewed drafts without requiring a third email', async () => {
    const batch = await createBatch({
      actor: { email: 'nate@example.com' },
      cowork_thread_id: 'cowork-thread-123',
      campaign_id: 'campaign-1',
      play_id: 'bdr_cold_outbound',
      companies: [{
        company_name: 'Kizik',
        domain: 'kizik.com',
        contacts: [{ first_name: 'Alex', last_name: 'Morgan', title: 'VP of Customer Experience', email: 'alex@example.com' }],
      }],
    });
    await processBatch(batch.id);
    const state = await getBatchReviewByToken(batch.review_token);
    state.runs[0].review.contacts[0].status = 'approved';
    await saveBatchReviewState(batch.review_token, { runs: [{ run_id: state.runs[0].run_id, contacts: state.runs[0].review.contacts }] }, 'reviewer@example.com');
    await submitBatchReview(batch.review_token, 'reviewer@example.com');
    const calls: any[] = [];

    const result = await pushApprovedContactsForBatch(batch.id, async (payload) => {
      calls.push(payload);
      return { instantly_lead_id: 'lead_1', campaign_paused: true };
    });

    expect(result.pushed).toBe(1);
    expect(calls[0].emails).toHaveLength(2);
    expect(calls[0].emails.map((email: any) => email.original_step_number)).toEqual([1, 4]);
  });
});
