import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRun, generateDraftForRun, getReviewStateByToken, pushApprovedContacts, resetStore, saveReviewState, submitApproved, type InstantlyPusher } from '@/lib/store';
import type { InstantlyPushPayload } from '@/lib/types';

describe('push worker', () => {
  beforeEach(() => resetStore());

  it('does not push approved contacts until review is submitted', async () => {
    const instantly = vi.fn<InstantlyPusher>(async (_payload: InstantlyPushPayload) => ({ instantly_lead_id: 'lead_123', campaign_paused: true, raw: { ok: true } }));
    const run = await createRun({ company_name: 'The Black Tux', mode: 'fast', source: 'api', contacts: [{ first_name: 'Alex', company: 'The Black Tux', email: 'alex@example.com' }] });
    await generateDraftForRun(run.id);
    const state = await getReviewStateByToken(run.review_token);
    state.contacts[0].status = 'approved';
    await saveReviewState(run.review_token, { contacts: state.contacts }, 'reviewer@example.com');

    await expect(pushApprovedContacts(run.id, instantly)).rejects.toThrow(/review_submitted/);
    expect(instantly).not.toHaveBeenCalled();
  });

  it('pushes approved contacts idempotently and skips needs-edit contacts', async () => {
    const instantly = vi.fn<InstantlyPusher>(async (_payload: InstantlyPushPayload) => ({ instantly_lead_id: 'lead_123', campaign_paused: true, raw: { ok: true } }));
    const run = await createRun({ company_name: 'The Black Tux', domain: 'theblacktux.com', mode: 'fast', source: 'api', campaign_id: 'camp_1', contacts: [{ first_name: 'Alex', company: 'The Black Tux', email: 'alex@example.com' }, { first_name: 'Sam', company: 'The Black Tux', email: 'sam@example.com' }] });
    await generateDraftForRun(run.id);
    const state = await getReviewStateByToken(run.review_token);
    state.contacts[0].status = 'approved';
    state.contacts[1].status = 'needs_edit';
    await saveReviewState(run.review_token, { contacts: state.contacts }, 'reviewer@example.com');
    await submitApproved(run.review_token, 'reviewer@example.com');

    const first = await pushApprovedContacts(run.id, instantly);
    const second = await pushApprovedContacts(run.id, instantly);

    expect(first.pushed).toBe(1);
    expect(first.failed).toBe(0);
    expect(second.pushed).toBe(0);
    expect(instantly).toHaveBeenCalledTimes(1);
    const firstCall = instantly.mock.calls[0];
    expect(firstCall).toBeDefined();
    expect(firstCall?.[0].email).toBe('alex@example.com');
  });
});
