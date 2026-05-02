import { BDR_PLAY_ID } from '@/lib/plays/bdr/types';
import { BDR_PROMPT_PACK_REVISION } from '@/lib/plays/bdr/prompt-pack';

export const BDR_CONTRACT_REVISION = 'bdr-vercel-pipeline-2026-05-01';

function configuredDeploymentUrl() {
  const raw = process.env.VERCEL_URL;
  if (!raw) return undefined;
  return raw.startsWith('http') ? raw : `https://${raw}`;
}

export function publicContractDiagnostics() {
  return {
    contract_revision: BDR_CONTRACT_REVISION,
    prompt_pack_revision: BDR_PROMPT_PACK_REVISION,
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
  const isBdr = playId === BDR_PLAY_ID;
  return {
    processing_route: isBdr ? 'bdr_workflow' : 'generic_company_agent',
    runtime: process.env.VERCEL ? 'vercel' : 'local',
    persistence: process.env.VERCEL ? 'database_required' : process.env.DATABASE_URL ? 'database' : 'memory',
    deployment: deploymentDiagnostics(),
    research_providers: {
      anthropic: process.env.ANTHROPIC_API_KEY ? 'configured' : 'missing',
      exa: process.env.EXA_API_KEY ? 'configured' : 'missing',
      firecrawl: process.env.FIRECRAWL_API_KEY ? 'configured' : 'missing',
      browserbase: process.env.BROWSERBASE_API_KEY ? 'configured' : 'missing_optional',
    },
    bdr_personalization: isBdr ? {
      optimized_dossier_path: 'enabled',
      prompt_pack_revision: BDR_PROMPT_PACK_REVISION,
      final_synthesis: process.env.ANTHROPIC_API_KEY && process.env.BDR_RESEARCH_AGENT_DISABLED !== 'true' ? 'structured_ai_sdk' : 'deterministic_dossier',
      fallback_causes: ['weak_evidence', 'provider_configuration', 'provider_failure', 'agent_failure', 'blocked_sequence_mapping'],
    } : undefined,
  };
}
