/**
 * AI prices and spend arithmetic (Unit 1.5, 2026-09-22). Pure.
 *
 * Anthropic first-party API rates, USD per million tokens, from the Claude API
 * reference as at 2026-09-22. Cache writes bill at 1.25 times the input rate
 * and cache reads at 0.1 times. Update this table when Anthropic changes its
 * prices; a model missing from it is refused rather than billed at a guess.
 */

/**
 * Claude Sonnet 5 from Phase 2 (2026-09-23): research, drafting and chat sit
 * well within its reach at well under the Opus price. Any agent can be moved
 * to another priced model in Growth Settings.
 */
export const DEFAULT_MODEL = 'claude-sonnet-5';

/** Server-side web search: USD 10 per 1,000 searches, on top of tokens. */
export const WEB_SEARCH_USD_PER_REQUEST = 0.01;

export const MODEL_PRICES: Readonly<Record<string, { inputPerMTok: number; outputPerMTok: number }>> = {
  'claude-opus-5': { inputPerMTok: 5, outputPerMTok: 25 },
  'claude-opus-4-8': { inputPerMTok: 5, outputPerMTok: 25 },
  'claude-sonnet-5': { inputPerMTok: 2, outputPerMTok: 10 },
  'claude-haiku-4-5': { inputPerMTok: 1, outputPerMTok: 5 },
};

export type TokenUsage = { inputTokens: number; outputTokens: number; cacheWriteTokens?: number; cacheReadTokens?: number; webSearchRequests?: number };

/** Cost of one call in USD, to six decimal places. Null for a model with no known price. */
export function costUsd(model: string, usage: TokenUsage): number | null {
  const p = MODEL_PRICES[model];
  if (!p) return null;
  const input = usage.inputTokens * p.inputPerMTok + (usage.cacheWriteTokens ?? 0) * p.inputPerMTok * 1.25 + (usage.cacheReadTokens ?? 0) * p.inputPerMTok * 0.1;
  const output = usage.outputTokens * p.outputPerMTok;
  const searches = (usage.webSearchRequests ?? 0) * WEB_SEARCH_USD_PER_REQUEST;
  return Math.round(((input + output) / 1_000_000 + searches) * 1e6) / 1e6;
}

/** Riyadh keeps UTC+3 all year: no daylight saving. */
const RIYADH_OFFSET_MS = 3 * 60 * 60 * 1000;

/** The Riyadh calendar month containing `now`, as YYYY-MM and its bounds in UTC [start, end). */
export function riyadhMonth(now: Date = new Date()): { key: string; start: Date; end: Date } {
  const local = new Date(now.getTime() + RIYADH_OFFSET_MS);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth();
  const start = new Date(Date.UTC(y, m, 1) - RIYADH_OFFSET_MS);
  const end = new Date(Date.UTC(y, m + 1, 1) - RIYADH_OFFSET_MS);
  return { key: `${y}-${String(m + 1).padStart(2, '0')}`, start, end };
}

/** Whether a call may go ahead against the monthly budget. */
export function budgetDecision(budgetUsd: number | null, spentUsd: number): { ok: true } | { ok: false; reason: 'no_budget' | 'budget_reached'; message: string } {
  if (budgetUsd === null || !(budgetUsd > 0)) return { ok: false, reason: 'no_budget', message: 'No monthly AI budget is set. Set one in Growth Settings before any AI runs.' };
  if (spentUsd >= budgetUsd) return { ok: false, reason: 'budget_reached', message: `This month's AI budget of USD ${budgetUsd.toFixed(2)} is reached (USD ${spentUsd.toFixed(2)} spent). AI calls resume next month or when the budget is raised.` };
  return { ok: true };
}

/** Whether spend has crossed the alert threshold. */
export function crossedThreshold(budgetUsd: number | null, spentUsd: number, thresholdPct: number): boolean {
  return budgetUsd !== null && budgetUsd > 0 && spentUsd >= (budgetUsd * thresholdPct) / 100;
}
