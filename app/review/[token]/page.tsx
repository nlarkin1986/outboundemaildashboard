import { ReviewApp } from '@/components/review/ReviewApp';
import { getReviewStateByToken } from '@/lib/store';
import { notFound } from 'next/navigation';

export default async function ReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const state = await getReviewStateByToken(token).catch(() => null);
  if (!state) notFound();
  return <ReviewApp initialState={state} token={token} />;
}
