import { notFound } from 'next/navigation';
import { BatchReviewApp } from '@/components/review/BatchReviewApp';
import { getBatchReviewByToken } from '@/lib/store';

export default async function BatchReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    const state = await getBatchReviewByToken(token);
    return <BatchReviewApp initialState={state} token={token} />;
  } catch {
    notFound();
  }
}
