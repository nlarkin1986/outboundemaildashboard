import { BDR_PLAY_ID } from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value : undefined;
}

export function metadataConfirmsBdrPlay(metadata?: Record<string, unknown>) {
  if (!metadata) return false;
  const intake = isRecord(metadata.intake) ? metadata.intake : undefined;
  return [
    metadata.confirmed_play,
    metadata.play_id,
    intake?.confirmed_play,
    intake?.play_id,
  ].map(stringValue).includes(BDR_PLAY_ID);
}

export function hasBdrRoutingMismatch({ play_id, play_metadata }: { play_id?: string; play_metadata?: Record<string, unknown> }) {
  return play_id !== BDR_PLAY_ID && metadataConfirmsBdrPlay(play_metadata);
}

export function assertNoBdrRoutingMismatch(input: { play_id?: string; play_metadata?: Record<string, unknown> }) {
  if (!hasBdrRoutingMismatch(input)) return;
  throw new Error(`BDR intake metadata confirmed ${BDR_PLAY_ID}, but durable play_id is missing. Set play_id to "${BDR_PLAY_ID}" or remove BDR metadata for a custom sequence.`);
}
