import { NextResponse } from 'next/server';
import { createRun, generateDraftForRun, listRuns, reviewUrlForRun } from '@/lib/store';

export async function GET() {
  return NextResponse.json({ runs: await listRuns() });
}

export async function POST(request: Request) {
  try {
    const run = await createRun(await request.json());
    // MVP: generate synchronously. Replace with Vercel Workflow/Queue in production.
    await generateDraftForRun(run.id);
    return NextResponse.json({ run_id: run.id, status: 'ready_for_review', review_url: reviewUrlForRun(run) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
