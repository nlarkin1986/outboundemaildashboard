export async function postCoworkMessage({ threadId, text, blocks, reviewUrl, batchId }: { threadId?: string; text: string; blocks?: unknown; reviewUrl?: string; batchId?: string }) {
  if (!process.env.COWORK_API_BASE_URL || !process.env.COWORK_API_KEY) {
    return { status: 'noop' as const, response: { reason: 'Cowork API env missing', text, reviewUrl, batchId } };
  }
  const response = await fetch(`${process.env.COWORK_API_BASE_URL.replace(/\/$/, '')}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.COWORK_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ thread_id: threadId, text, blocks, review_url: reviewUrl, batch_id: batchId }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) return { status: 'failed' as const, response: body, error: `Cowork post failed: ${response.status}` };
  return { status: 'sent' as const, response: body };
}

export async function postCoworkBatchReady({ batchId, threadId, reviewUrl }: { batchId: string; threadId?: string; reviewUrl: string }) {
  return postCoworkMessage({ threadId, batchId, reviewUrl, text: `Your outbound dashboard is ready: ${reviewUrl}` });
}

export async function postCoworkPushSummary({ batchId, threadId, pushed, failed }: { batchId: string; threadId?: string; pushed: number; failed: number }) {
  return postCoworkMessage({ threadId, batchId, text: `Instantly push complete for batch ${batchId}: ${pushed} pushed, ${failed} failed.` });
}
