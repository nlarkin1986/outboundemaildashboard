import { beforeEach, describe, expect, it } from 'vitest';
import { createRun, generateDraftForRun, getReviewStateByToken, resetStore, saveReviewState, submitApproved } from '@/lib/store';

describe('review flow', () => {
  beforeEach(() => resetStore());

  it('persists edits, approval state, and queues push only for approved contacts', async () => {
    const run = await createRun({ company_name: 'The Black Tux', domain: 'theblacktux.com', mode: 'fast', source: 'cowork', contacts: [{ first_name: 'Alex', last_name: 'Morgan', company: 'The Black Tux', email: 'alex@example.com' }] });
    await generateDraftForRun(run.id);
    const state = await getReviewStateByToken(run.review_token);
    expect(state.run.status).toBe('ready_for_review');

    const contact = state.contacts[0];
    contact.status = 'approved';
    contact.emails[0].subject = 'event-date handoffs edited';
    await saveReviewState(run.review_token, { contacts: [contact] }, 'reviewer@example.com');

    const updated = await getReviewStateByToken(run.review_token);
    expect(updated.contacts[0].status).toBe('approved');
    expect(updated.contacts[0].emails[0].subject).toBe('event-date handoffs edited');

    const submitted = await submitApproved(run.review_token, 'reviewer@example.com');
    expect(submitted.approved_count).toBe(1);
    expect(submitted.push_job_id).toBeTruthy();
  });
});
