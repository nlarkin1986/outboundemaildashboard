import { NextResponse } from 'next/server';
import { publicContractDiagnostics } from '@/lib/mcp/diagnostics';

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'outbound-approval-vercel',
    ...publicContractDiagnostics(),
  });
}
