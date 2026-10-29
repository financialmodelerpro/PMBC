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
 *
 * Result tool (2026-10-29): an agent that needs a structured answer passes
 * `resultTool`. It is offered as a strict tool next to web search, with
 * tool_choice auto (forced tool choice is refused by some current models).
 * The call ends when the model calls it; if the model finishes without doing
 * so, it is asked once to call it now. The tool input is returned as
 * `toolInput`, along with every request's stop reason.
 */

import Anthropic from '@anthropic-ai/sdk';

import type { AiProvider, ProviderRequest, ProviderResponse } from './provider';

const FALLBACK_MODELS = new Set(['claude-opus-5']);
const MAX_RESUMES = 3;
const REPORT_NOW = (name: string) => `Call ${name} now, once, with every event you found, or with an empty list if none qualified. Do not search again.`;

export function createAnthropicProvider(apiKey: string): AiProvider {
  const client = new Anthropic({ apiKey });
  return {
    name: 'anthropic',
    isMock: false,
    async call(req: ProviderRequest): Promise<ProviderResponse> {
      const messages: Anthropic.Beta.BetaMessageParam[] = req.messages.map((m) => ({ role: m.role, content: m.content }));
      const tools: Anthropic.Beta.BetaToolUnion[] = [];
      if (req.webSearch) tools.push({ type: 'web_search_20260209', name: 'web_search', max_uses: req.webSearch.maxUses });
      if (req.resultTool) tools.push({ name: req.resultTool.name, description: req.resultTool.description, input_schema: req.resultTool.inputSchema as Anthropic.Beta.BetaTool.InputSchema, strict: true });
      const result = req.resultTool?.name;
      const fallback = FALLBACK_MODELS.has(req.model);
      const totals = { input: 0, output: 0, cacheWrite: 0, cacheRead: 0, searches: 0 };
      const urls = new Set<string>();
      const texts: string[] = [];
      let model = req.model;
      let refused = false;
      let toolInput: unknown = undefined;
      let reminded = false;
      const stopReasons: string[] = [];

      // Resumes after a paused turn, plus one reminder to report.
      for (let attempt = 0; attempt <= MAX_RESUMES + 1; attempt++) {
        const response = await client.beta.messages.create(
          {
            model: req.model,
            max_tokens: req.maxTokens,
            ...(req.system ? { system: req.system } : {}),
            messages,
            ...(tools.length ? { tools } : {}),
            ...(result ? { tool_choice: { type: 'auto' as const } } : {}),
            ...(fallback ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
          },
          req.timeoutMs ? { timeout: req.timeoutMs, maxRetries: 1 } : undefined,
        );
        stopReasons.push(String(response.stop_reason));
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
          if (block.type === 'tool_use' && result && block.name === result && toolInput === undefined) toolInput = block.input;
          if (block.type === 'text') {
            texts.push(block.text);
            for (const c of block.citations ?? []) if ('url' in c && typeof c.url === 'string') urls.add(c.url);
          }
        }
        if (response.stop_reason === 'refusal') {
          refused = true;
          break;
        }
        if (toolInput !== undefined) break;
        if (response.stop_reason === 'pause_turn') {
          messages.push({ role: 'assistant', content: response.content as Anthropic.Beta.BetaContentBlockParam[] });
          continue;
        }
        // Finished without reporting: ask once for the tool call, so the answer is never left as prose.
        if (result && !reminded && response.stop_reason === 'end_turn') {
          reminded = true;
          messages.push({ role: 'assistant', content: response.content as Anthropic.Beta.BetaContentBlockParam[] });
          messages.push({ role: 'user', content: REPORT_NOW(result) });
          continue;
        }
        break;
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
        toolInput: refused ? undefined : toolInput,
        stopReasons,
        requests: stopReasons.length,
      };
    },
  };
}
