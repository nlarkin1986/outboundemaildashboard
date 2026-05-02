import { NextResponse } from 'next/server';
import { createBatch, reviewUrlForBatchToken } from '@/lib/store';
import { resolveOutboundPlayRoute } from '@/lib/plays/bdr/intake-agent';

export const maxDuration = 60;

function normalizeEmail(value: unknown) {
  if (typeof value !== 'string') return undefined;
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : undefined;
}

function firstEmail(...values: unknown[]) {
  for (const value of values) {
    const email = normalizeEmail(value);
    if (email) return email;
  }
  return undefined;
}

export function normalizeCoworkBatchPayload(body: any) {
  const payload = body?.data ?? body?.payload ?? body;
  const companies = payload.companies ?? payload.accounts ?? payload.company_list ?? [];
  const actorEmail = firstEmail(
    body?.actor?.email,
    body?.user?.email,
    body?.requested_by?.email,
    body?.requested_by_email,
    body?.user_email,
    body?.actor_email,
    body?.created_by_email,
    payload?.actor?.email,
    payload?.user?.email,
    payload?.requested_by?.email,
    payload?.requested_by_email,
    payload?.user_email,
    payload?.actor_email,
    payload?.created_by_email,
    payload?.requested_by,
    body?.requested_by,
  );
  const actor = actorEmail ? {
    email: actorEmail,
    name: payload?.actor?.name ?? payload?.user?.name ?? body?.actor?.name ?? body?.user?.name,
    cowork_user_id: payload?.actor?.cowork_user_id ?? payload?.user?.cowork_user_id ?? body?.actor?.cowork_user_id ?? body?.user?.cowork_user_id,
    cowork_org_id: payload?.actor?.cowork_org_id ?? payload?.user?.cowork_org_id ?? body?.actor?.cowork_org_id ?? body?.user?.cowork_org_id,
    cowork_thread_id: payload?.actor?.cowork_thread_id ?? payload?.cowork_thread_id ?? payload?.thread_id ?? body?.thread_id,
  } : undefined;

  return {
    actor,
    requested_by: actorEmail ?? payload.requested_by ?? body?.requested_by,
    requested_by_email: actorEmail,
    cowork_thread_id: payload.cowork_thread_id ?? payload.thread_id ?? payload.threadId ?? body?.thread_id ?? body?.threadId,
    campaign_id: payload.campaign_id ?? payload.campaignId,
    mode: payload.mode ?? 'fast',
    source: 'cowork' as const,
    play_id: payload.play_id ?? payload.playId,
    play_metadata: payload.play_metadata ?? payload.playMetadata,
    request_context: payload.request_context ?? payload.requestContext ?? payload.user_request ?? payload.userRequest ?? payload.message ?? payload.prompt,
    user_request: payload.user_request ?? payload.userRequest,
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
    const payload = normalizeCoworkBatchPayload(body);
    if (!payload.actor?.email && (process.env.VERCEL || process.env.NODE_ENV === 'production') && process.env.ALLOW_MISSING_COWORK_ACTOR_EMAIL !== 'true') {
      return NextResponse.json({ error: 'Cowork actor email is required' }, { status: 400 });
    }
    const routed = await resolveOutboundPlayRoute(payload);
    const batch = await createBatch({ ...payload, ...routed.input });
    return NextResponse.json({
      ok: true,
      type: body?.type ?? 'outbound.batch.requested',
      batch_id: batch.id,
      status: batch.status,
      play_id: batch.play_id,
      review_url: reviewUrlForBatchToken(batch.review_token),
      dashboard_status_url: `${process.env.APP_BASE_URL ?? 'http://localhost:3000'}/admin/runs?batch_id=${batch.id}`,
      process_url: `/api/internal/process-batch/${batch.id}`,
      created_by: batch.requested_by,
      account_id: batch.account_id,
      routing: { selected_route: routed.selected_route, source: routed.source },
      warnings: routed.warnings,
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
