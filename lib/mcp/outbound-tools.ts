import type { BatchStatus } from '@/lib/types';
import { createBatch, getBatchById, listBatchRuns, reviewUrlForBatchToken, updateBatchStatus, upsertUserFromCoworkActor } from '@/lib/store';
import { dashboardStatusUrl, pollingMetadata } from '@/lib/cowork/continuation';
import { triggerBatchProcessing } from '@/lib/jobs/triggerBatchProcessing';
import { createOutboundSequenceSchema, getOutboundSequenceStatusSchema, type CreateOutboundSequenceInput, type GetOutboundSequenceStatusInput } from './schemas';

export async function createOutboundSequence(input: CreateOutboundSequenceInput) {
  const parsed = createOutboundSequenceSchema.safeParse(input);
  if (!parsed.success) throw new Error(`A valid actor email is required: ${parsed.error.message}`);
  const data = parsed.data;
  const owner = await upsertUserFromCoworkActor(data.actor);
  const batch = await createBatch({
    actor: data.actor,
    requested_by: owner.user.email,
    cowork_thread_id: data.actor.cowork_thread_id,
    campaign_id: data.campaign_id ?? undefined,
    mode: data.mode,
    source: 'cowork',
    target_persona: data.target_persona,
    companies: data.companies,
  });

  let status: BatchStatus = batch.status;
  const warnings: string[] = [];
  const trigger = await triggerBatchProcessing(batch.id);
  if (trigger.warning) warnings.push(trigger.warning);
  if (trigger.started && status === 'queued') {
    status = 'processing';
    await updateBatchStatus(batch.id, status);
  }

  return {
    ok: true as const,
    batch_id: batch.id,
    status,
    review_url: reviewUrlForBatchToken(batch.review_token),
    dashboard_status_url: dashboardStatusUrl(batch.id),
    ...pollingMetadata(status),
    processing: {
      started: trigger.started,
      mode: trigger.mode,
    },
    created_by: owner.user.email,
    account_domain: owner.account.domain,
    warnings,
  };
}

export async function getOutboundSequenceStatus(input: GetOutboundSequenceStatusInput) {
  const parsed = getOutboundSequenceStatusSchema.safeParse(input);
  if (!parsed.success) throw new Error(`A valid actor email is required: ${parsed.error.message}`);
  const owner = await upsertUserFromCoworkActor(parsed.data.actor);
  const batch = await getBatchById(parsed.data.batch_id);
  if (!batch) throw new Error(`Batch not found: ${parsed.data.batch_id}`);
  if (batch.account_id && batch.account_id !== owner.account.id) throw new Error('Actor cannot access this batch');
  const runs = await listBatchRuns(batch.id);
  return {
    ok: true as const,
    batch_id: batch.id,
    status: batch.status,
    review_url: batch.review_url ?? reviewUrlForBatchToken(batch.review_token),
    dashboard_status_url: dashboardStatusUrl(batch.id),
    ...pollingMetadata(batch.status),
    created_by: batch.requested_by,
    account_domain: owner.account.domain,
    run_counts: {
      total: runs.length,
      ready_for_review: runs.filter((run) => run.status === 'ready_for_review').length,
      failed: runs.filter((run) => run.status === 'failed').length,
    },
    errors: runs.filter((run) => run.error).map((run) => ({ run_id: run.run_id, error: run.error })),
  };
}
