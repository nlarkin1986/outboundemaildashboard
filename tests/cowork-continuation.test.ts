import { describe, expect, it } from 'vitest';
import {
  coworkDeepLinkForBatch,
  coworkNextActionForStatus,
  dashboardStatusUrl,
  pollingMetadata,
} from '@/lib/cowork/continuation';

describe('cowork continuation helpers', () => {
  it('builds an encoded dashboard status URL for a batch', () => {
    const url = dashboardStatusUrl('batch_abc 123');
    expect(url).toBe('http://localhost:3000/admin/runs?batch_id=batch_abc%20123');
  });

  it('instructs Cowork to keep polling queued, processing, and pushing batches', () => {
    expect(coworkNextActionForStatus('queued')).toEqual({
      state: 'queued',
      instruction: expect.stringMatching(/wait|get_outbound_sequence_status|actor\.email/i),
    });
    expect(coworkNextActionForStatus('processing')).toEqual({
      state: 'processing',
      instruction: expect.stringMatching(/wait|get_outbound_sequence_status|actor\.email/i),
    });
    expect(coworkNextActionForStatus('pushing')).toEqual({
      state: 'pushing',
      instruction: expect.stringMatching(/push|wait|get_outbound_sequence_status/i),
    });
  });

  it('instructs Cowork to present review links and stop polling when ready', () => {
    const action = coworkNextActionForStatus('ready_for_review');
    expect(action.state).toBe('ready_for_review');
    expect(action.instruction).toMatch(/review_url|dashboard_status_url|stop polling/i);
    expect(pollingMetadata('ready_for_review').is_terminal).toBe(true);
  });

  it('instructs Cowork to surface dashboard errors and stop polling when failed', () => {
    const action = coworkNextActionForStatus('failed');
    expect(action.state).toBe('failed');
    expect(action.instruction).toMatch(/errors|dashboard_status_url|stop polling/i);
    expect(pollingMetadata('failed').is_terminal).toBe(true);
  });

  it('does not include secrets or generated bodies in JSON-safe metadata', () => {
    const json = JSON.stringify({
      dashboard_status_url: dashboardStatusUrl('batch_public_check'),
      ...pollingMetadata('processing'),
    });
    expect(json).not.toMatch(/API_KEY|SECRET|DATABASE_URL|body_html|body_text|original_body/i);
  });

  it('builds compact Cowork deep links from durable handles only', () => {
    const link = coworkDeepLinkForBatch({
      batchId: 'batch_abc123',
      dashboardStatusUrl: 'https://example.com/admin/runs?batch_id=batch_abc123',
      reviewUrl: 'https://example.com/review/batch/token',
    });
    expect(link).toMatch(/^claude:\/\/cowork\/new\?q=/);
    const prompt = decodeURIComponent(link.split('q=')[1]);
    expect(prompt).toContain('Batch ID: batch_abc123');
    expect(prompt).toContain('Dashboard: https://example.com/admin/runs?batch_id=batch_abc123');
    expect(prompt).toContain('Review: https://example.com/review/batch/token');
    expect(prompt).not.toMatch(/body_html|body_text|research payload|generated sequence/i);
    expect(link.length).toBeLessThan(14_000);
  });
});
