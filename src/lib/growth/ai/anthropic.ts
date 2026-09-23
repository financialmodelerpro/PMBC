/**
 * The real provider: Claude through the official Anthropic SDK (Unit 1.5,
 * 2026-09-22). Used only when ANTHROPIC_API_KEY is set. Server only.
 *
 * Refusals: requests to Claude Opus 5 opt into server-side refusal fallbacks
 * (`fallbacks: 'default'`), so a request it declines is re-run on Anthropic's
 * recommended fallback model inside the same call. A refusal that survives the
 * chain is reported as `refused`, never as an answer. Other models are called
 * without the parameter.
 *
 * Web search (Unit 2.4): when the request asks for it, the server-side web
 * search tool is offered. A long search can pause the turn; the call is
 * resumed up to three times. Token usage and searches are summed across the
 * resumed requests, and every URL a search returned or a citation named is
 * reported back so the agent can check its sources against them.
 */

import Anthropic from '@anthropic-ai/sdk';

import type { AiProvider, ProviderRequest, ProviderResponse } from './provider';

const FALLBACK_MODELS = new Set(['claude-opus-5']);
const MAX_RESUMES = 3;

export function createAnthropicProvider(apiKey: string): AiProvider {
  const client = new Anthropic({ apiKey });
  return {
    name: 'anthropic',
    isMock: false,
    async call(req: ProviderRequest): Promise<ProviderResponse> {
      const messages: Anthropic.Beta.BetaMessageParam[] = req.messages.map((m) => ({ role: m.role, content: m.content }));
      const tools: Anthropic.Beta.BetaToolUnion[] | undefined = req.webSearch ? [{ type: 'web_search_20260209', name: 'web_search', max_uses: req.webSearch.maxUses }] : undefined;
      const fallback = FALLBACK_MODELS.has(req.model);
      const totals = { input: 0, output: 0, cacheWrite: 0, cacheRead: 0, searches: 0 };
      const urls = new Set<string>();
      const texts: string[] = [];
      let model = req.model;
      let refused = false;

      for (let attempt = 0; attempt <= MAX_RESUMES; attempt++) {
        const response = await client.beta.messages.create({
          model: req.model,
          max_tokens: req.maxTokens,
          ...(req.system ? { system: req.system } : {}),
          messages,
          ...(tools ? { tools } : {}),
          ...(fallback ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
        });
        model = response.model;
        totals.input += response.usage.input_tokens;
        totals.output += response.usage.output_tokens;
        totals.cacheWrite += response.usage.cache_creation_input_tokens ?? 0;
        totals.cacheRead += response.usage.cache_read_input_tokens ?? 0;
        totals.searches += response.usage.server_tool_use?.web_search_requests ?? 0;

        for (const block of response.content) {
          if (block.type === 'web_search_tool_result' && Array.isArray(block.content)) {
            for (const r of block.content) if (r.type === 'web_search_result') urls.add(r.url);
          }
          if (block.type === 'text') {
            texts.push(block.text);
            for (const c of block.citations ?? []) if ('url' in c && typeof c.url === 'string') urls.add(c.url);
          }
        }
        if (response.stop_reason === 'refusal') {
          refused = true;
          break;
        }
        if (response.stop_reason !== 'pause_turn') break;
        messages.push({ role: 'assistant', content: response.content as Anthropic.Beta.BetaContentBlockParam[] });
      }

      return {
        text: refused ? '' : texts.join(''),
        model,
        inputTokens: totals.input,
        outputTokens: totals.output,
        cacheWriteTokens: totals.cacheWrite,
        cacheReadTokens: totals.cacheRead,
        refused,
        webSearchRequests: totals.searches,
        sourceUrls: [...urls],
      };
    },
  };
}
