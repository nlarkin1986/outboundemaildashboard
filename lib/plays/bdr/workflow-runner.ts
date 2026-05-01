import type { CompanyAgentOutput } from '@/lib/agent/schemas';
import type { BatchContactInput, CompanyInput } from '@/lib/schemas';
import { findPeopleWithExa, type PeopleResult } from '@/lib/ai/tools';
import { bdrContactKey, createBdrSequencePlans } from './sequence-plan';
import { researchBdrPlaceholders } from './placeholder-research';
import { renderBdrWorkflowOutput } from './workflow-output';
import { defaultBdrResearchProvider, type BdrResearchProvider } from './research';
import type { BdrPlaceholderResearch, BdrSequencePlan } from './types';

export type BdrWorkflowResult = {
  output: CompanyAgentOutput;
  sequence_plans: BdrSequencePlan[];
  placeholder_research: BdrPlaceholderResearch[];
};

export type BdrContactDiscoveryProvider = (company: CompanyInput) => Promise<PeopleResult[]>;

const bdrTargetPersona = 'VP customer experience OR director customer experience OR head of support OR support operations OR ecommerce director OR digital transformation leader';

function splitNameAndTitle(value: string): { name: string; title?: string } {
  const parts = value
    .split(/\s+(?:[-–—]|\|)\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 2) return { name: value };
  return { name: parts[0], title: parts.slice(1).join(' - ') };
}

function candidateToContact(company: CompanyInput, candidate: PeopleResult): BatchContactInput {
  const parsed = splitNameAndTitle(candidate.name);
  return {
    name: parsed.name,
    title: candidate.title ?? parsed.title,
    company: company.company_name,
    domain: company.domain,
  };
}

function normalized(value?: string) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function domainLabel(domain?: string) {
  return normalized(domain?.replace(/^www\./i, '').split('.')[0]);
}

function candidateReferencesCompany(company: CompanyInput, candidate: PeopleResult) {
  const haystack = normalized([candidate.name, candidate.title, candidate.evidence_title, candidate.evidence_url].filter(Boolean).join(' '));
  const companyNeedle = normalized(company.company_name);
  const domainNeedle = domainLabel(company.domain);
  return Boolean(
    (companyNeedle && haystack.includes(companyNeedle)) ||
    (domainNeedle && haystack.includes(domainNeedle)),
  );
}

async function defaultContactDiscoveryProvider(company: CompanyInput) {
  return findPeopleWithExa(company.company_name, company.domain, bdrTargetPersona);
}

async function resolveBdrContacts(company: CompanyInput, contactDiscoveryProvider: BdrContactDiscoveryProvider): Promise<BatchContactInput[]> {
  const supplied = company.contacts ?? [];
  if (supplied.some((contact) => contact.title)) return supplied;

  const discovered = await contactDiscoveryProvider(company);
  const companyMatched = discovered.filter((candidate) => candidateReferencesCompany(company, candidate));
  if (companyMatched.length > 0) return companyMatched.map((candidate) => candidateToContact(company, candidate));

  if (supplied.length > 0) return supplied;
  return [{ name: 'Contact needed', title: undefined }];
}

export async function runBdrPlayWorkflow({
  company,
  researchProvider = defaultBdrResearchProvider,
  contactDiscoveryProvider = defaultContactDiscoveryProvider,
}: {
  company: CompanyInput;
  researchProvider?: BdrResearchProvider;
  contactDiscoveryProvider?: BdrContactDiscoveryProvider;
}): Promise<BdrWorkflowResult> {
  const contacts = await resolveBdrContacts(company, contactDiscoveryProvider);
  const { plans } = await createBdrSequencePlans({ company, contacts, researchProvider });
  const placeholderMap = new Map<string, BdrPlaceholderResearch>();

  for (let index = 0; index < contacts.length; index++) {
    const plan = plans[index];
    if (!plan?.sequence_code) continue;
    const research = await researchBdrPlaceholders({ company, plan, researchProvider });
    if (research) placeholderMap.set(bdrContactKey(contacts[index], index), research);
  }

  return {
    output: renderBdrWorkflowOutput({ company, contacts, plans, placeholderResearch: placeholderMap }),
    sequence_plans: plans,
    placeholder_research: [...placeholderMap.values()],
  };
}
