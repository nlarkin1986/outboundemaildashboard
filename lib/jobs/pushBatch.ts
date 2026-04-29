import { pushLeadToInstantly } from '@/lib/instantly/client';
import { postCoworkPushSummary } from '@/lib/cowork/client';
import { getBatchById, pushApprovedContactsForBatch } from '@/lib/store';

export async function pushBatch(batchId: string) {
  const batch = await getBatchById(batchId);
  const result = await pushApprovedContactsForBatch(batchId, pushLeadToInstantly);
  await postCoworkPushSummary({ batchId, threadId: batch?.cowork_thread_id, pushed: result.pushed, failed: result.failed });
  return result;
}
