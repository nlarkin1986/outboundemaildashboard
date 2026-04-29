import { ReviewApp } from '@/components/review/ReviewApp';
import { getReviewStateByToken } from '@/lib/store';
import { notFound } from 'next/navigation';

export default async function ReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    const state = await getReviewStateByToken(token);
    return <ReviewApp initialState={state} token={token} />;
  } catch {
    notFound();
  }
}
