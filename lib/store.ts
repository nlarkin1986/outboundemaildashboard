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
