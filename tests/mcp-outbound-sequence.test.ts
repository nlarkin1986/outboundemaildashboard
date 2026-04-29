import { beforeEach, describe, expect, it } from 'vitest';
import { processBatch } from '@/lib/jobs/processBatch';
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

  it('creates a durable batch handle with polling instructions without inline processing', async () => {
    const result = await createOutboundSequence({
      actor: { email: 'user@company.com', cowork_thread_id: 'thread-1' },
      companies: [{ company_name: 'Quince', domain: 'onequince.com' }],
      mode: 'fast',
    });

    expect(result.ok).toBe(true);
    expect(result.batch_id).toMatch(/^batch_/);
    expect(result.status).toBe('processing');
    expect(result.review_url).toContain('/review/batch/');
    expect(result.dashboard_status_url).toContain(`/admin/runs?batch_id=${result.batch_id}`);
    expect(result.poll_tool).toBe('get_outbound_sequence_status');
    expect(result.recommended_poll_after_seconds).toBe(30);
    expect(result.max_poll_attempts).toBe(8);
    expect(result.is_terminal).toBe(false);
    expect(result.cowork_next_action.instruction).toMatch(/get_outbound_sequence_status|review|poll/i);
    expect(result.processing).toEqual({ started: true, mode: 'not-started' });
    expect(result.created_by).toBe('user@company.com');
    expect(result.account_domain).toBe('company.com');
    expect(JSON.stringify(result)).not.toMatch(/API_KEY|SECRET|DATABASE_URL/i);

    const status = await getOutboundSequenceStatus({ batch_id: result.batch_id, actor: { email: 'user@company.com' } });
    expect(status.ok).toBe(true);
    expect(status.batch_id).toBe(result.batch_id);
    expect(status.status).toBe('processing');
    expect(status.run_counts.total).toBe(0);
  });

  it('returns polling metadata and run counts when fetching status for a processed batch', async () => {
    const result = await createOutboundSequence({
      actor: { email: 'user@company.com', cowork_thread_id: 'thread-1' },
      companies: [{ company_name: 'Quince', domain: 'onequince.com' }],
      mode: 'fast',
    });
    await processBatch(result.batch_id);

    const status = await getOutboundSequenceStatus({ batch_id: result.batch_id, actor: { email: 'user@company.com' } });
    expect(status.ok).toBe(true);
    expect(status.batch_id).toBe(result.batch_id);
    expect(status.status).toBe('ready_for_review');
    expect(status.review_url).toContain('/review/batch/');
    expect(status.dashboard_status_url).toContain(`/admin/runs?batch_id=${result.batch_id}`);
    expect(status.poll_tool).toBe('get_outbound_sequence_status');
    expect(status.recommended_poll_after_seconds).toBe(30);
    expect(status.max_poll_attempts).toBe(8);
    expect(status.cowork_next_action.instruction).toMatch(/review|poll|status/i);
    expect(typeof status.is_terminal).toBe('boolean');
    expect(status.is_terminal).toBe(true);
    expect(status.run_counts.total).toBe(1);
    expect(status.run_counts.ready_for_review).toBe(1);
    expect(status.run_counts.failed).toBe(0);
  });
});
