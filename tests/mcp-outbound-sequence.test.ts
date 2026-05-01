import { beforeEach, describe, expect, it } from 'vitest';
import { processBatch } from '@/lib/jobs/processBatch';
import { createBatch, resetStore } from '@/lib/store';
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
    expect(result.processing).toMatchObject({ started: true, mode: 'not-started' });
    expect(result.processing.correlation_id).toMatch(/^batch-trigger-/);
    expect(result.processing.requested_at).toEqual(expect.any(String));
    expect(result.created_by).toBe('user@company.com');
    expect(result.account_domain).toBe('company.com');
    expect(result.diagnostics).toMatchObject({ processing_route: 'generic_company_agent' });
    expect(JSON.stringify(result)).not.toMatch(/API_KEY|SECRET|DATABASE_URL/i);

    const status = await getOutboundSequenceStatus({ batch_id: result.batch_id, actor: { email: 'user@company.com' } });
    expect(status.ok).toBe(true);
    expect(status.batch_id).toBe(result.batch_id);
    expect(status.status).toBe('processing');
    expect(status.run_counts.total).toBe(0);
    expect(status.processing).toMatchObject({ state: 'triggered_no_runs_yet', run_count: 0 });
    expect(status.diagnostics).toMatchObject({ processing_route: 'generic_company_agent' });
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
    expect(status.processing).toMatchObject({ state: 'completed', run_count: 1 });
  });

  it('preserves BDR intake metadata while keeping status responses sanitized', async () => {
    const result = await createOutboundSequence({
      actor: { email: 'bdr@company.com', cowork_thread_id: 'thread-bdr' },
      play_id: 'bdr_cold_outbound',
      play_metadata: {
        intake: {
          user_request_summary: 'Sequence Kizik contacts through the BDR play.',
          confirmed_play: 'bdr_cold_outbound',
          known_missing_fields: ['email'],
          push_intent: 'review_first',
        },
      },
      companies: [{
        company_name: 'Kizik',
        domain: 'kizik.com',
        contacts: [{ name: 'Alex Morgan', title: 'VP of Customer Experience' }],
      }],
      mode: 'fast',
    });

    expect(result.play_id).toBe('bdr_cold_outbound');
    await processBatch(result.batch_id);

    const status = await getOutboundSequenceStatus({ batch_id: result.batch_id, actor: { email: 'bdr@company.com' } });
    expect(status.play_id).toBe('bdr_cold_outbound');
    expect(status.status).toBe('ready_for_review');
    expect(status.diagnostics).toMatchObject({
      processing_route: 'bdr_workflow',
      runtime: 'local',
      persistence: 'memory',
      research_providers: { exa: 'missing' },
    });
    expect(JSON.stringify(status)).not.toMatch(/user_request_summary|known_missing_fields|sequence_plans|placeholder_research/i);
    expect(JSON.stringify(status)).not.toMatch(/API_KEY|SECRET|DATABASE_URL/i);
  });

  it('rejects BDR-confirming metadata when the durable play id is missing', async () => {
    await expect(createOutboundSequence({
      actor: { email: 'bdr@company.com', cowork_thread_id: 'thread-bdr' },
      play_metadata: {
        intake: {
          confirmed_play: 'bdr_cold_outbound',
          user_request_summary: 'Run the BDR play for KiwiCo and Steven Holm.',
        },
      },
      companies: [{
        company_name: 'KiwiCo',
        domain: 'kiwico.com',
        contacts: [{ name: 'Steven Holm', title: 'Director of Customer Care' }],
      }],
      mode: 'fast',
    })).rejects.toThrow(/play_id/i);
  });

  it('processes MCP-created BDR batches without generic company-agent copy', async () => {
    const result = await createOutboundSequence({
      actor: { email: 'bdr@company.com', cowork_thread_id: 'thread-bdr' },
      play_id: 'bdr_cold_outbound',
      play_metadata: {
        intake: {
          confirmed_play: 'bdr_cold_outbound',
          user_request_summary: 'Run the BDR play for KiwiCo and Steven Holm.',
        },
      },
      companies: [{
        company_name: 'KiwiCo',
        domain: 'kiwico.com',
        contacts: [{ name: 'Steven Holm', title: 'Director of Customer Care' }],
      }],
      mode: 'fast',
    });

    await processBatch(result.batch_id);

    const status = await getOutboundSequenceStatus({ batch_id: result.batch_id, actor: { email: 'bdr@company.com' } });
    const serialized = JSON.stringify(status);

    expect(status.play_id).toBe('bdr_cold_outbound');
    expect(status.status).toBe('ready_for_review');
    expect(status.diagnostics).toMatchObject({ processing_route: 'bdr_workflow' });
    expect(serialized).not.toMatch(/handoffs without the reset|full conversation history|before it becomes urgent/i);
    expect(serialized).not.toMatch(/KUHL: 44% reduction in WISMO emails/i);
  });

  it('reports batch-level routing mismatch errors in status polling', async () => {
    const batch = await createBatch({
      actor: { email: 'bdr@company.com', cowork_thread_id: 'thread-bdr' },
      play_metadata: { intake: { confirmed_play: 'bdr_cold_outbound' } },
      companies: [{ company_name: 'KiwiCo', domain: 'kiwico.com' }],
    });

    await processBatch(batch.id);

    const status = await getOutboundSequenceStatus({ batch_id: batch.id, actor: { email: 'bdr@company.com' } });

    expect(status.status).toBe('partially_failed');
    expect(status.processing.state).toBe('error_reported');
    expect(status.errors[0]).toMatchObject({ batch_id: batch.id, error: expect.stringMatching(/durable play_id/i) });
  });
});
