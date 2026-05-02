import { generateObject } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { generatedContactSequenceSchema, type GeneratedContactSequence } from './schemas';
import { buildSequencePrompt, GLADLY_OUTBOUND_SYSTEM_PROMPT } from './prompts';

export async function generateSequenceWithClaude(companyName: string, domain?: string): Promise<GeneratedContactSequence | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const result = await generateObject({
    model: anthropic('claude-sonnet-4-5'),
    schema: generatedContactSequenceSchema,
    system: GLADLY_OUTBOUND_SYSTEM_PROMPT,
    prompt: buildSequencePrompt(companyName, domain),
  });
  return result.object;
}
