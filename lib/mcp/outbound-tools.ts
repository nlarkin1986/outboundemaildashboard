import type { BatchStatus } from '@/lib/types';
import { createBatch, getBatchById, listBatchRuns, reviewUrlForBatchToken, updateBatchStatus, upsertUserFromCoworkActor } from '@/lib/store';
import { dashboardStatusUrl, pollingMetadata } from '@/lib/cowork/continuation';
import { triggerBatchProcessing } from '@/lib/jobs/triggerBatchProcessing';
import { resolveOutboundPlayRoute } from '@/lib/plays/bdr/intake-agent';
import { routeDiagnostics } from '@/lib/mcp/diagnostics';
import { createOutboundSequenceSchema, getOutboundSequenceStatusSchema, type CreateOutboundSequenceInput, type GetOutboundSequenceStatusInput } from './schemas';

function processingState(status: BatchStatus, runCount: number, hasErrors: boolean) {
  if (hasErrors) return 'error_reported';
  if (status === 'queued') return 'not_started';
  if (status === 'processing' && runCount === 0) return 'triggered_no_runs_yet';
  if (status === 'processing') return 'runs_in_progress';
  if (status === 'ready_for_review') return 'completed';
  return status;
}

export async function createOutboundSequence(input: CreateOutboundSequenceInput) {
  const parsed = createOutboundSequenceSchema.safeParse(input);
  if (!parsed.success) throw new Error(`A valid actor email is required: ${parsed.error.message}`);
  const data = parsed.data;
  const routed = await resolveOutboundPlayRoute(data);
  const routedInput = routed.input;
  const owner = await upsertUserFromCoworkActor(data.actor);
  const batch = await createBatch({
    actor: data.actor,
    requested_by: owner.user.email,
    cowork_thread_id: data.actor.cowork_thread_id,
    campaign_id: routedInput.campaign_id ?? undefined,
    mode: routedInput.mode,
    source: 'cowork',
    play_id: routedInput.play_id,
    play_metadata: routedInput.play_metadata,
    target_persona: routedInput.target_persona,
    companies: routedInput.companies,
  });

  let status: BatchStatus = batch.status;
  const warnings: string[] = [];
  const trigger = await triggerBatchProcessing(batch.id);
  warnings.push(...routed.warnings);
  if (trigger.warning) warnings.push(trigger.warning);
  if (trigger.started && status === 'queued') {
    status = 'processing';
    await updateBatchStatus(batch.id, status);
  }

  return {
    ok: true as const,
    batch_id: batch.id,
    status,
    play_id: batch.play_id,
    review_url: reviewUrlForBatchToken(batch.review_token),
    dashboard_status_url: dashboardStatusUrl(batch.id),
    ...pollingMetadata(status),
    processing: {
      started: trigger.started,
      mode: trigger.mode,
      correlation_id: trigger.correlation_id,
      requested_at: trigger.requested_at,
      internal_path: trigger.internal_path,
    },
    created_by: owner.user.email,
    account_domain: owner.account.domain,
    diagnostics: routeDiagnostics(batch.play_id),
    routing: {
      selected_route: routed.selected_route,
      source: routed.source,
    },
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
  const hasErrors = Boolean(batch.error || runs.some((run) => run.error));
  let status = batch.status;
  if (status === 'processing' && runs.length > 0 && runs.every((run) => run.status === 'ready_for_review') && !hasErrors) {
    status = 'ready_for_review';
    await updateBatchStatus(batch.id, status);
  }
  return {
    ok: true as const,
    batch_id: batch.id,
    status,
    play_id: batch.play_id,
    review_url: batch.review_url ?? reviewUrlForBatchToken(batch.review_token),
    dashboard_status_url: dashboardStatusUrl(batch.id),
    ...pollingMetadata(status),
    created_by: batch.requested_by,
    account_domain: owner.account.domain,
    diagnostics: routeDiagnostics(batch.play_id),
    processing: {
      state: processingState(status, runs.length, hasErrors),
      run_count: runs.length,
    },
    run_counts: {
      total: runs.length,
      ready_for_review: runs.filter((run) => run.status === 'ready_for_review').length,
      failed: runs.filter((run) => run.status === 'failed').length,
    },
    errors: [
      ...(batch.error ? [{ batch_id: batch.id, error: batch.error }] : []),
      ...runs.filter((run) => run.error).map((run) => ({ run_id: run.run_id, error: run.error })),
    ],
  };
}
