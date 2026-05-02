import { beforeEach, describe, expect, it } from 'vitest';
import { createBatch, getBatchById, resetStore, upsertUserFromCoworkActor } from '@/lib/store';
import { normalizeCoworkBatchPayload, POST } from '@/app/api/webhooks/cowork/batch/route';

describe('cowork identity and account ownership', () => {
  beforeEach(() => resetStore());

  it('normalizes Cowork actor email and reuses the same user for the same email', async () => {
    const first = await upsertUserFromCoworkActor({ email: '  Jane@Gladly.com ', name: 'Jane Smith', cowork_user_id: 'cowork-user-1' });
    const second = await upsertUserFromCoworkActor({ email: 'jane@gladly.com', name: 'Jane Smith' });

    expect(first.user.id).toBe(second.user.id);
    expect(first.user.email).toBe('jane@gladly.com');
    expect(first.account.domain).toBe('gladly.com');
  });

  it('shares an account for different users on the same email domain', async () => {
    const jane = await upsertUserFromCoworkActor({ email: 'jane@gladly.com' });
    const alex = await upsertUserFromCoworkActor({ email: 'alex@gladly.com' });

    expect(alex.user.id).not.toBe(jane.user.id);
    expect(alex.account.id).toBe(jane.account.id);
    expect(alex.user.account_id).toBe(jane.account.id);
  });

  it('rejects missing or invalid email when upserting Cowork actor identity', async () => {
    await expect(upsertUserFromCoworkActor({ email: '' })).rejects.toThrow(/valid actor email/i);
    await expect(upsertUserFromCoworkActor({ email: 'not-an-email' })).rejects.toThrow(/valid actor email/i);
  });

  it('extracts actor email from common Cowork payload shapes and uses it as requested_by', () => {
    const normalized = normalizeCoworkBatchPayload({
      payload: {
        user: { email: 'Nate@Example.com', name: 'Nate' },
        cowork_thread_id: 'thread-1',
        companies: ['Quince'],
      },
    });

    expect(normalized.actor?.email).toBe('nate@example.com');
    expect(normalized.requested_by).toBe('nate@example.com');
  });

  it('stores batch ownership when actor email is provided', async () => {
    const batch = await createBatch({
      actor: { email: 'owner@company.com', name: 'Owner' },
      companies: [{ company_name: 'Quince', domain: 'onequince.com' }],
    });
    const stored = await getBatchById(batch.id);

    expect(stored?.requested_by).toBe('owner@company.com');
    expect(stored?.account_id).toBeTruthy();
    expect(stored?.created_by_user_id).toBeTruthy();
  });

  it('creates ownership from legacy email fields when actor object is absent', async () => {
    const batch = await createBatch({
      user_email: 'legacy@company.com',
      companies: [{ company_name: 'LegacyCo' }],
    });

    expect(batch.requested_by).toBe('legacy@company.com');
    expect(batch.account_id).toBeTruthy();
    expect(batch.created_by_user_id).toBeTruthy();
  });

  it('infers webhook BDR play id from BDR metadata when play_id is omitted', async () => {
    const previousSecret = process.env.COWORK_WEBHOOK_SECRET;
    process.env.COWORK_WEBHOOK_SECRET = 'test-secret';
    try {
      const response = await POST(new Request('http://localhost/api/webhooks/cowork/batch', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-cowork-secret': 'test-secret' },
        body: JSON.stringify({
          payload: {
            user: { email: 'bdr@company.com' },
            play_metadata: { intake: { confirmed_play: 'bdr_cold_outbound' } },
            companies: [{ company_name: 'KiwiCo', domain: 'kiwico.com' }],
          },
        }),
      }));
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body.play_id).toBe('bdr_cold_outbound');
      expect(body.routing).toMatchObject({ selected_route: 'bdr_workflow', source: 'metadata' });
    } finally {
      if (previousSecret === undefined) delete process.env.COWORK_WEBHOOK_SECRET;
      else process.env.COWORK_WEBHOOK_SECRET = previousSecret;
    }
  });
});
