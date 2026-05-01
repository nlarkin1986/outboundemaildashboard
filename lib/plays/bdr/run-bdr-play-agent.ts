import type { CompanyInput } from '@/lib/schemas';
import type { CompanyAgentOutput } from '@/lib/agent/schemas';
import type { BdrResearchProvider } from './research';
import { runBdrPlayWorkflow, type BdrContactDiscoveryProvider } from './workflow-runner';

export async function runBdrPlayAgent({
  company,
  researchProvider,
  contactDiscoveryProvider,
}: {
  company: CompanyInput;
  researchProvider?: BdrResearchProvider;
  contactDiscoveryProvider?: BdrContactDiscoveryProvider;
}): Promise<CompanyAgentOutput> {
  const result = await runBdrPlayWorkflow({ company, researchProvider, contactDiscoveryProvider });
  return result.output;
}
