import { beforeEach, describe, expect, it, vi } from 'vitest';
import { triggerBatchProcessing } from '@/lib/jobs/triggerBatchProcessing';

describe('triggerBatchProcessing', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('does not start without an internal API secret outside test mode', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('APP_BASE_URL', 'https://example.com');

    await expect(triggerBatchProcessing('batch_1')).resolves.toEqual({
      started: false,
      mode: 'not-started',
      correlation_id: expect.stringMatching(/^batch-trigger-/),
      requested_at: expect.any(String),
      warning: expect.stringMatching(/INTERNAL_API_SECRET/i),
    });
  });

  it('fails closed for invalid app base URLs before sending the internal secret', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('INTERNAL_API_SECRET', 'super-secret');
    vi.stubEnv('APP_BASE_URL', 'not a url with SECRET');
    vi.stubEnv('VERCEL_URL', 'also invalid');

    await expect(triggerBatchProcessing('batch_1')).resolves.toEqual({
      started: false,
      mode: 'not-started',
      correlation_id: expect.stringMatching(/^batch-trigger-/),
      requested_at: expect.any(String),
      warning: expect.stringMatching(/APP_BASE_URL/i),
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('starts an internal endpoint request with an encoded batch id when configured', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('INTERNAL_API_SECRET', 'super-secret');
    vi.stubEnv('APP_BASE_URL', 'https://example.com/some-path');

    await expect(triggerBatchProcessing('batch with spaces')).resolves.toEqual({
      started: true,
      mode: 'internal-endpoint',
      correlation_id: expect.stringMatching(/^batch-trigger-/),
      requested_at: expect.any(String),
      internal_path: '/api/internal/process-batch/batch%20with%20spaces',
    });
    expect(fetchSpy).toHaveBeenCalledWith('https://example.com/api/internal/process-batch/batch%20with%20spaces', {
      method: 'POST',
      headers: {
        authorization: 'Bearer super-secret',
        'x-batch-trigger-id': expect.stringMatching(/^batch-trigger-/),
      },
    });
  });

  it('does not report started when the internal endpoint rejects the trigger', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 503 }));
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('INTERNAL_API_SECRET', 'super-secret');
    vi.stubEnv('APP_BASE_URL', 'https://example.com');

    await expect(triggerBatchProcessing('batch_1')).resolves.toEqual({
      started: false,
      mode: 'internal-endpoint',
      correlation_id: expect.stringMatching(/^batch-trigger-/),
      requested_at: expect.any(String),
      internal_path: '/api/internal/process-batch/batch_1',
      warning: expect.stringMatching(/status 503/i),
    });
  });

  it('does not report started when the internal endpoint cannot be reached', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network unavailable'));
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('INTERNAL_API_SECRET', 'super-secret');
    vi.stubEnv('APP_BASE_URL', 'https://example.com');

    await expect(triggerBatchProcessing('batch_1')).resolves.toEqual({
      started: false,
      mode: 'internal-endpoint',
      correlation_id: expect.stringMatching(/^batch-trigger-/),
      requested_at: expect.any(String),
      internal_path: '/api/internal/process-batch/batch_1',
      warning: expect.stringMatching(/network unavailable/i),
    });
  });
});
