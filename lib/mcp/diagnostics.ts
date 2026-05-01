import { BDR_PLAY_ID } from '@/lib/plays/bdr/types';

export const BDR_CONTRACT_REVISION = 'bdr-vercel-pipeline-2026-05-01';

function configuredDeploymentUrl() {
  const raw = process.env.VERCEL_URL;
  if (!raw) return undefined;
  return raw.startsWith('http') ? raw : `https://${raw}`;
}

export function publicContractDiagnostics() {
  return {
    contract_revision: BDR_CONTRACT_REVISION,
  };
}

export function deploymentDiagnostics() {
  return {
    ...publicContractDiagnostics(),
    environment: process.env.VERCEL_ENV ?? (process.env.VERCEL ? 'vercel' : 'local'),
    deployment_url: configuredDeploymentUrl(),
    git: {
      commit_sha: process.env.VERCEL_GIT_COMMIT_SHA,
      branch: process.env.VERCEL_GIT_COMMIT_REF,
    },
  };
}

export function routeDiagnostics(playId?: string) {
  return {
    processing_route: playId === BDR_PLAY_ID ? 'bdr_workflow' : 'generic_company_agent',
    runtime: process.env.VERCEL ? 'vercel' : 'local',
    persistence: process.env.VERCEL ? 'database_required' : process.env.DATABASE_URL ? 'database' : 'memory',
    deployment: deploymentDiagnostics(),
    research_providers: {
      exa: process.env.EXA_API_KEY ? 'configured' : 'missing',
    },
  };
}
