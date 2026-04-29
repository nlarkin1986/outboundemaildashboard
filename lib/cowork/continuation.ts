import type { BatchStatus } from '@/lib/types';

export const DEFAULT_POLL_SECONDS = 30;
export const DEFAULT_MAX_POLL_ATTEMPTS = 8;

export type CoworkNextActionState =
  | 'queued'
  | 'processing'
  | 'ready_for_review'
  | 'review_submitted'
  | 'pushing'
  | 'pushed'
  | 'partially_failed'
  | 'failed';

export type CoworkNextAction = {
  state: CoworkNextActionState;
  instruction: string;
};

function safeUrl(value: string | undefined) {
  if (!value) return undefined;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return undefined;
    return parsed.origin;
  } catch {
    return undefined;
  }
}

export function appBaseUrl() {
  return safeUrl(process.env.APP_BASE_URL)
    ?? safeUrl(process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined)
    ?? 'http://localhost:3000';
}

export function dashboardStatusUrl(batchId: string) {
  return `${appBaseUrl()}/admin/runs?batch_id=${encodeURIComponent(batchId)}`;
}

export function isTerminalCoworkStatus(status: BatchStatus) {
  return ['ready_for_review', 'partially_failed', 'failed', 'review_submitted', 'pushed'].includes(status);
}

export function coworkNextActionForStatus(status: BatchStatus): CoworkNextAction {
  if (status === 'queued') {
    return {
      state: 'queued',
      instruction: 'The outbound batch has been queued. Wait about 30 seconds, then call get_outbound_sequence_status with this batch_id and actor.email.',
    };
  }
  if (status === 'processing') {
    return {
      state: 'processing',
      instruction: 'The outbound batch is still processing. Wait about 30 seconds, then call get_outbound_sequence_status again with the same batch_id and actor.email.',
    };
  }
  if (status === 'ready_for_review') {
    return {
      state: 'ready_for_review',
      instruction: 'The outbound batch is ready for review. Present the review_url and dashboard_status_url to the user. Stop polling.',
    };
  }
  if (status === 'partially_failed') {
    return {
      state: 'partially_failed',
      instruction: 'The outbound batch partially failed. Summarize any errors from the status response and present the dashboard_status_url. Stop polling.',
    };
  }
  if (status === 'failed') {
    return {
      state: 'failed',
      instruction: 'The outbound batch failed. Surface the errors and dashboard_status_url to the user. Stop polling.',
    };
  }
  if (status === 'review_submitted') {
    return {
      state: 'review_submitted',
      instruction: 'The review has been submitted. Tell the user approved contacts are queued for push or already processing. Stop polling unless asked to check push status.',
    };
  }
  if (status === 'pushing') {
    return {
      state: 'pushing',
      instruction: 'The approved outbound contacts are being pushed. Wait about 30 seconds, then call get_outbound_sequence_status again with the same batch_id and actor.email.',
    };
  }
  if (status === 'pushed') {
    return {
      state: 'pushed',
      instruction: 'The approved outbound contacts have been pushed. Summarize completion to the user. Stop polling.',
    };
  }
  return {
    state: 'processing',
    instruction: 'The outbound batch is in progress. Wait about 30 seconds, then call get_outbound_sequence_status again.',
  };
}

export function pollingMetadata(status: BatchStatus) {
  return {
    poll_tool: 'get_outbound_sequence_status' as const,
    recommended_poll_after_seconds: DEFAULT_POLL_SECONDS,
    max_poll_attempts: DEFAULT_MAX_POLL_ATTEMPTS,
    is_terminal: isTerminalCoworkStatus(status),
    cowork_next_action: coworkNextActionForStatus(status),
  };
}

export function coworkDeepLinkForBatch(input: { batchId: string; dashboardStatusUrl: string; reviewUrl?: string }) {
  const prompt = [
    'The Gladly outbound workflow is ready to continue.',
    '',
    `Batch ID: ${input.batchId}`,
    `Dashboard: ${input.dashboardStatusUrl}`,
    input.reviewUrl ? `Review: ${input.reviewUrl}` : undefined,
    '',
    'Please call get_outbound_sequence_status for this batch and continue from the backend result.',
  ].filter(Boolean).join('\n');

  return `claude://cowork/new?q=${encodeURIComponent(prompt)}`;
}
