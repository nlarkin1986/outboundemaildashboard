import { NextResponse } from 'next/server';
import { submitApproved } from '@/lib/store';

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    const actor = request.headers.get('x-reviewer') ?? 'anonymous';
    return NextResponse.json(await submitApproved(token, actor));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
