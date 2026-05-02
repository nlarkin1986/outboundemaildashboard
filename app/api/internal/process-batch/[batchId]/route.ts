import { after, NextResponse } from 'next/server';
import { processBatch } from '@/lib/jobs/processBatch';

export const maxDuration = 300;

function scheduleBatchProcessing(batchId: string, triggerId?: string) {
  const task = async () => {
    try {
      await processBatch(batchId, { triggerId });
    } catch (error) {
      console.error('Failed to process triggered batch', {
        batchId,
        triggerId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  try {
    after(task);
  } catch {
    void task();
  }
}

export async function POST(request: Request, context: { params: Promise<{ batchId: string }> }) {
  if (!process.env.INTERNAL_API_SECRET) {
    return NextResponse.json({ error: 'INTERNAL_API_SECRET is not configured; process endpoint is disabled' }, { status: 503 });
  }
  if (request.headers.get('authorization') !== `Bearer ${process.env.INTERNAL_API_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { batchId } = await context.params;
    const triggerId = request.headers.get('x-batch-trigger-id') ?? undefined;
    scheduleBatchProcessing(batchId, triggerId);
    return NextResponse.json({ ok: true, batch_id: batchId, status: 'accepted', trigger_id: triggerId }, { status: 202 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
