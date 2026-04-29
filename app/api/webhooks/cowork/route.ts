import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  if (process.env.COWORK_WEBHOOK_SECRET && request.headers.get('x-cowork-secret') !== process.env.COWORK_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  return NextResponse.json({ ok: true, received: body?.type ?? 'unknown', note: 'Wire this endpoint to POST /api/runs once Cowork event contract is confirmed.' });
}
