import { describe, expect, it, beforeEach } from 'vitest';
import { createRun, resetStore } from '@/lib/store';

describe('run creation', () => {
  beforeEach(() => resetStore());

  it('creates a queued run and dedupes contacts by email', async () => {
    const run = await createRun({
      company_name: 'The Black Tux',
      domain: 'theblacktux.com',
      mode: 'fast',
      source: 'cowork',
      contacts: [
        { first_name: 'Alex', last_name: 'Morgan', title: 'VP CX', company: 'The Black Tux', email: 'alex@example.com', domain: 'theblacktux.com' },
        { first_name: 'Alex', last_name: 'Morgan', title: 'VP CX', company: 'The Black Tux', email: 'ALEX@example.com', domain: 'theblacktux.com' }
      ]
    });

    expect(run.status).toBe('queued');
    expect(run.contacts).toHaveLength(1);
    expect(run.contacts[0].email).toBe('alex@example.com');
    expect(run.review_token).toHaveLength(64);
  });

  it('rejects invalid email addresses', async () => {
    await expect(createRun({
      company_name: 'Bad Co',
      mode: 'fast',
      source: 'api',
      contacts: [{ company: 'Bad Co', email: 'not-an-email' }]
    })).rejects.toThrow(/Invalid run payload/);
  });
});
