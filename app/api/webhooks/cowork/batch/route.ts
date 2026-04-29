import { NextResponse } from 'next/server';
import { createBatch, reviewUrlForBatchToken } from '@/lib/store';

function normalizeCoworkBatchPayload(body: any) {
  const payload = body?.data ?? body?.payload ?? body;
  const companies = payload.companies ?? payload.accounts ?? payload.company_list ?? [];
  return {
    requested_by: payload.requested_by ?? body?.requested_by,
    cowork_thread_id: payload.cowork_thread_id ?? payload.thread_id ?? payload.threadId ?? body?.thread_id ?? body?.threadId,
    campaign_id: payload.campaign_id ?? payload.campaignId,
    mode: payload.mode ?? 'fast',
    source: 'cowork' as const,
    target_persona: payload.target_persona ?? payload.targetPersona,
    companies: companies.map((company: any) => typeof company === 'string' ? { company_name: company } : {
      company_name: company.company_name ?? company.companyName ?? company.name,
      domain: company.domain ?? company.company_domain,
      contacts: company.contacts ?? company.people ?? company.prospects,
    }),
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
    const batch = await createBatch(normalizeCoworkBatchPayload(body));
    return NextResponse.json({
      ok: true,
      type: body?.type ?? 'outbound.batch.requested',
      batch_id: batch.id,
      status: batch.status,
      review_url: reviewUrlForBatchToken(batch.review_token),
      dashboard_status_url: `${process.env.APP_BASE_URL ?? 'http://localhost:3000'}/admin/runs?batch_id=${batch.id}`,
      process_url: `/api/internal/process-batch/${batch.id}`,
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
