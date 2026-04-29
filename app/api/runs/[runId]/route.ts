import { NextResponse } from 'next/server';
import { getRun, reviewUrlForRun } from '@/lib/store';

export async function GET(_request: Request, context: { params: Promise<{ runId: string }> }) {
  const { runId } = await context.params;
  const run = await getRun(runId);
  if (!run) return NextResponse.json({ error: 'Run not found' }, { status: 404 });
  return NextResponse.json({ ...run, review_url: reviewUrlForRun(run) });
}
