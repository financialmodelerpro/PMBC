/**
 * The AI provider seam (Unit 1.5, 2026-09-22). Agents never see a provider:
 * they call `runAi` (run.ts), which picks one here. Swapping or adding a
 * provider means a new implementation of `AiProvider`, not a change to agents.
 *
 * With ANTHROPIC_API_KEY unset the mock provider answers; once it is set the
 * Anthropic provider does, with no code change.
 *
 * Web search (Unit 2.4): an agent that needs sources asks for `webSearch`. The
 * provider reports how many searches ran (each is billed) and every URL the
 * searches and citations returned, so an agent can refuse a "source" the
 * search never saw.
 */

export type AiMessage = { role: 'user' | 'assistant'; content: string };

export type ProviderRequest = {
  model: string;
  system?: string;
  messages: AiMessage[];
  maxTokens: number;
  /** What the call is for; the mock provider shapes its sample answer by it. */
  purpose: string;
  agent: string;
  /** Let the model search the web, at most `maxUses` times. */
  webSearch?: { maxUses: number };
};

export type ProviderResponse = {
  text: string;
  /** The model that actually answered (a refusal fallback may differ). */
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
  /** The model declined the request even after any fallback. */
  refused: boolean;
  /** Web searches run during the call (billed per search). */
  webSearchRequests?: number;
  /** Every URL returned by a web search result or a citation in the answer. */
  sourceUrls?: string[];
};

export interface AiProvider {
  readonly name: 'mock' | 'anthropic';
  readonly isMock: boolean;
  call(req: ProviderRequest): Promise<ProviderResponse>;
}

/** Mock mode is on exactly when no Anthropic key is set. */
export function isMockMode(env: Record<string, string | undefined> = process.env): boolean {
  return !env.ANTHROPIC_API_KEY?.trim();
}

/** The provider for this environment. Loaded lazily so the SDK is only imported when a key exists. */
export async function selectProvider(env: Record<string, string | undefined> = process.env): Promise<AiProvider> {
  if (isMockMode(env)) {
    const { mockProvider } = await import('./mock');
    return mockProvider;
  }
  const { createAnthropicProvider } = await import('./anthropic');
  return createAnthropicProvider(env.ANTHROPIC_API_KEY as string);
}
