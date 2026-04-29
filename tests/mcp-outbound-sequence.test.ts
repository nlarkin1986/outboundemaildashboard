import { beforeEach, describe, expect, it } from 'vitest';
import { resetStore } from '@/lib/store';
import { createOutboundSequence, getOutboundSequenceStatus } from '@/lib/mcp/outbound-tools';

describe('mcp outbound sequence tools', () => {
  beforeEach(() => resetStore());

  it('requires actor email', async () => {
    await expect(createOutboundSequence({
      actor: { email: '' },
      companies: [{ company_name: 'Quince', domain: 'onequince.com' }],
    })).rejects.toThrow(/valid actor email/i);
  });

  it('creates a batch, starts processing, and returns safe review and status URLs', async () => {
    const result = await createOutboundSequence({
      actor: { email: 'user@company.com', cowork_thread_id: 'thread-1' },
      companies: [{ company_name: 'Quince', domain: 'onequince.com' }],
      mode: 'fast',
    });

    expect(result.ok).toBe(true);
    expect(result.batch_id).toMatch(/^batch_/);
    expect(result.review_url).toContain('/review/batch/');
    expect(result.dashboard_status_url).toContain(`/admin/runs?batch_id=${result.batch_id}`);
    expect(result.created_by).toBe('user@company.com');
    expect(result.account_domain).toBe('company.com');
    expect(JSON.stringify(result)).not.toMatch(/API_KEY|SECRET|DATABASE_URL/i);

    const status = await getOutboundSequenceStatus({ batch_id: result.batch_id, actor: { email: 'user@company.com' } });
    expect(status.ok).toBe(true);
    expect(status.batch_id).toBe(result.batch_id);
    expect(status.run_counts.total).toBe(1);
  });
});
