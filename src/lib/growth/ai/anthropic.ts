/**
 * The real provider: Claude through the official Anthropic SDK (Unit 1.5,
 * 2026-09-22). Used only when ANTHROPIC_API_KEY is set. Server only.
 *
 * Refusals: requests opt into server-side refusal fallbacks
 * (`fallbacks: 'default'`), so a request Claude Opus 5 declines is re-run on
 * Anthropic's recommended fallback model inside the same call. A refusal that
 * survives the chain is reported as `refused`, never as an answer.
 */

import Anthropic from '@anthropic-ai/sdk';

import type { AiProvider, ProviderRequest, ProviderResponse } from './provider';

export function createAnthropicProvider(apiKey: string): AiProvider {
  const client = new Anthropic({ apiKey });
  return {
    name: 'anthropic',
    isMock: false,
    async call(req: ProviderRequest): Promise<ProviderResponse> {
      const response = await client.beta.messages.create({
        model: req.model,
        max_tokens: req.maxTokens,
        ...(req.system ? { system: req.system } : {}),
        messages: req.messages,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
      });
      const refused = response.stop_reason === 'refusal';
      const text = refused
        ? ''
        : response.content
            .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
            .map((b) => b.text)
            .join('\n');
      return {
        text,
        model: response.model,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        cacheWriteTokens: response.usage.cache_creation_input_tokens ?? 0,
        cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
        refused,
      };
    },
  };
}
