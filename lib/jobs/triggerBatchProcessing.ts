export type TriggerBatchProcessingResult = {
  started: boolean;
  mode: 'inline-dev' | 'internal-endpoint' | 'not-started';
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
  if (process.env.NODE_ENV === 'test') {
    return { started: true, mode: 'not-started' };
  }

  if (!process.env.INTERNAL_API_SECRET) {
    return {
      started: false,
      mode: 'not-started',
      warning: 'INTERNAL_API_SECRET is not configured; batch was created but processing was not auto-started.',
    };
  }

  const baseUrl = configuredAppOrigin();
  if (!baseUrl) {
    return {
      started: false,
      mode: 'not-started',
      warning: 'APP_BASE_URL is not configured or invalid; batch was created but processing was not auto-started.',
    };
  }

  fetch(`${baseUrl}/api/internal/process-batch/${encodeURIComponent(batchId)}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.INTERNAL_API_SECRET}` },
  }).then((response) => {
    if (!response.ok) {
      console.error('Failed to trigger batch processing', { batchId, status: response.status });
    }
  }).catch((error) => {
    console.error('Failed to trigger batch processing', {
      batchId,
      error: error instanceof Error ? error.message : String(error),
    });
  });

  return { started: true, mode: 'internal-endpoint' };
}
