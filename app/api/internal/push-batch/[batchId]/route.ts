import { NextResponse } from 'next/server';
import { pushBatch } from '@/lib/jobs/pushBatch';

export async function POST(request: Request, context: { params: Promise<{ batchId: string }> }) {
  if (!process.env.INTERNAL_API_SECRET) {
    return NextResponse.json({ error: 'INTERNAL_API_SECRET is not configured; push endpoint is disabled' }, { status: 503 });
  }
  if (request.headers.get('authorization') !== `Bearer ${process.env.INTERNAL_API_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { batchId } = await context.params;
    return NextResponse.json(await pushBatch(batchId));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
