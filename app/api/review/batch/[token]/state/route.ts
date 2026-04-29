import { NextResponse } from 'next/server';
import { getBatchReviewByToken } from '@/lib/store';

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    return NextResponse.json(await getBatchReviewByToken(token));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 404 });
  }
}
