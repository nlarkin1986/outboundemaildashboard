import { notFound } from 'next/navigation';
import { BatchReviewApp } from '@/components/review/BatchReviewApp';
import { getBatchReviewByToken } from '@/lib/store';

export default async function BatchReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const state = await getBatchReviewByToken(token).catch(() => null);
  if (!state) notFound();
  return <BatchReviewApp initialState={state} token={token} />;
}
