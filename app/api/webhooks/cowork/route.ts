import { NextResponse } from 'next/server';
import { createRun, generateDraftForRun, reviewUrlForRun } from '@/lib/store';

function normalizeCoworkPayload(body: any) {
  const payload = body?.data ?? body?.payload ?? body;
  return {
    company_name: payload.company_name ?? payload.companyName ?? payload.company?.name ?? payload.account?.name,
    domain: payload.domain ?? payload.company_domain ?? payload.company?.domain ?? payload.account?.domain,
    mode: payload.mode ?? 'fast',
    source: 'cowork' as const,
    campaign_id: payload.campaign_id ?? payload.campaignId,
    cowork_thread_id: payload.cowork_thread_id ?? payload.thread_id ?? payload.threadId ?? body?.thread_id ?? body?.threadId,
    contacts: payload.contacts ?? payload.people ?? payload.prospects ?? [],
  };
}

export async function POST(request: Request) {
  if (!process.env.COWORK_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'COWORK_WEBHOOK_SECRET is not configured' }, { status: 503 });
  }

  const providedSecret = request.headers.get('x-cowork-secret') ?? request.headers.get('x-webhook-secret');
  if (providedSecret !== process.env.COWORK_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const run = await createRun(normalizeCoworkPayload(body));
    // MVP: generate synchronously. Replace with queue/workflow for larger Cowork batches.
    await generateDraftForRun(run.id);
    return NextResponse.json(
      {
        ok: true,
        type: body?.type ?? 'cowork.outbound_run.created',
        run_id: run.id,
        status: 'ready_for_review',
        review_url: reviewUrlForRun(run),
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
