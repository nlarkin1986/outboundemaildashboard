import { hasDatabaseUrl } from './db';
import * as memoryStore from './memory-store';
import * as postgresStore from './postgres-store';
import type { Run } from './types';

function store() {
  if (hasDatabaseUrl()) return postgresStore;
  if (process.env.VERCEL || process.env.FORCE_DATABASE_STORE === 'true') {
    throw new Error('DATABASE_URL is required for Vercel/production persistence. Refusing to use the in-memory store.');
  }
  return memoryStore;
}

export function resetStore() { return store().resetStore(); }
export function createRun(...args: Parameters<typeof memoryStore.createRun>) { return store().createRun(...args); }
export function listRuns() { return store().listRuns(); }
export function getRun(...args: Parameters<typeof memoryStore.getRun>) { return store().getRun(...args); }
export function generateDraftForRun(...args: Parameters<typeof memoryStore.generateDraftForRun>) { return store().generateDraftForRun(...args); }
export function getReviewStateByToken(...args: Parameters<typeof memoryStore.getReviewStateByToken>) { return store().getReviewStateByToken(...args); }
export function saveReviewState(...args: Parameters<typeof memoryStore.saveReviewState>) { return store().saveReviewState(...args); }
export function submitApproved(...args: Parameters<typeof memoryStore.submitApproved>) { return store().submitApproved(...args); }
export type InstantlyPusher = memoryStore.InstantlyPusher;
export function pushApprovedContacts(...args: Parameters<typeof memoryStore.pushApprovedContacts>) { return store().pushApprovedContacts(...args); }

export function reviewUrlForRun(run: Run) {
  const appBase = process.env.APP_BASE_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  return `${appBase}/review/${run.review_token}`;
}

export function createBatch(...args: Parameters<typeof memoryStore.createBatch>) { return store().createBatch(...args); }
export function upsertUserFromCoworkActor(...args: Parameters<typeof memoryStore.upsertUserFromCoworkActor>) { return store().upsertUserFromCoworkActor(...args); }
export function getBatchById(...args: Parameters<typeof memoryStore.getBatchById>) { return store().getBatchById(...args); }
export function getBatchReviewByToken(...args: Parameters<typeof memoryStore.getBatchReviewByToken>) { return store().getBatchReviewByToken(...args); }
export function listBatchRuns(...args: Parameters<typeof memoryStore.listBatchRuns>) { return store().listBatchRuns(...args); }
export function attachRunToBatch(...args: Parameters<typeof memoryStore.attachRunToBatch>) { return store().attachRunToBatch(...args); }
export function updateBatchStatus(...args: Parameters<typeof memoryStore.updateBatchStatus>) { return store().updateBatchStatus(...args); }
export function updateBatchRunStatus(...args: Parameters<typeof memoryStore.updateBatchRunStatus>) { return store().updateBatchRunStatus(...args); }
export function saveResearchArtifact(...args: Parameters<typeof memoryStore.saveResearchArtifact>) { return store().saveResearchArtifact(...args); }
export function saveBatchReviewState(...args: Parameters<typeof memoryStore.saveBatchReviewState>) { return store().saveBatchReviewState(...args); }
export function submitBatchReview(...args: Parameters<typeof memoryStore.submitBatchReview>) { return store().submitBatchReview(...args); }
export function recordCoworkMessage(...args: Parameters<typeof memoryStore.recordCoworkMessage>) { return store().recordCoworkMessage(...args); }
export function pushApprovedContactsForBatch(...args: Parameters<typeof memoryStore.pushApprovedContactsForBatch>) { return store().pushApprovedContactsForBatch(...args); }

export function reviewUrlForBatchToken(token: string) {
  const appBase = process.env.APP_BASE_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  return `${appBase}/review/batch/${token}`;
}
