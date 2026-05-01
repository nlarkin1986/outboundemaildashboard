import crypto from 'node:crypto';

export type TriggerBatchProcessingResult = {
  started: boolean;
  mode: 'inline-dev' | 'internal-endpoint' | 'not-started';
  correlation_id: string;
  requested_at: string;
  internal_path?: string;
  warning?: string;
};

function configuredAppOrigin() {
  const rawBaseUrl = process.env.APP_BASE_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);
  if (!rawBaseUrl) return undefined;
  try {
    const parsed = new URL(rawBaseUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return undefined;
    return parsed.origin;
  } catch {
    return undefined;
  }
}

export async function triggerBatchProcessing(batchId: string): Promise<TriggerBatchProcessingResult> {
  const correlationId = `batch-trigger-${crypto.randomUUID()}`;
  const requestedAt = new Date().toISOString();
  if (process.env.NODE_ENV === 'test') {
    return { started: true, mode: 'not-started', correlation_id: correlationId, requested_at: requestedAt };
  }

  if (!process.env.INTERNAL_API_SECRET) {
    return {
      started: false,
      mode: 'not-started',
      correlation_id: correlationId,
      requested_at: requestedAt,
      warning: 'INTERNAL_API_SECRET is not configured; batch was created but processing was not auto-started.',
    };
  }

  const baseUrl = configuredAppOrigin();
  if (!baseUrl) {
    return {
      started: false,
      mode: 'not-started',
      correlation_id: correlationId,
      requested_at: requestedAt,
      warning: 'APP_BASE_URL is not configured or invalid; batch was created but processing was not auto-started.',
    };
  }

  const internalPath = `/api/internal/process-batch/${encodeURIComponent(batchId)}`;
  fetch(`${baseUrl}${internalPath}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${process.env.INTERNAL_API_SECRET}`,
      'x-batch-trigger-id': correlationId,
    },
  }).then((response) => {
    if (!response.ok) {
      console.error('Failed to trigger batch processing', { batchId, correlationId, status: response.status });
    }
  }).catch((error) => {
    console.error('Failed to trigger batch processing', {
      batchId,
      correlationId,
      error: error instanceof Error ? error.message : String(error),
    });
  });

  return { started: true, mode: 'internal-endpoint', correlation_id: correlationId, requested_at: requestedAt, internal_path: internalPath };
}
