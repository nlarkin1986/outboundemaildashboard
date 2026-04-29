import { NextResponse } from 'next/server';
import { pushLeadToInstantly } from '@/lib/instantly/client';
import { pushApprovedContacts } from '@/lib/store';

export async function POST(request: Request, context: { params: Promise<{ runId: string }> }) {
  if (!process.env.INTERNAL_API_SECRET) {
    return NextResponse.json({ error: 'INTERNAL_API_SECRET is not configured; push endpoint is disabled' }, { status: 503 });
  }
  if (request.headers.get('authorization') !== `Bearer ${process.env.INTERNAL_API_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { runId } = await context.params;
    return NextResponse.json(await pushApprovedContacts(runId, pushLeadToInstantly));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
