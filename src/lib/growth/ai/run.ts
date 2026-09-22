/**
 * The one way the Growth Engine calls AI (Unit 1.5, 2026-09-22). Server only.
 *
 * Every agent calls `runAi`. It, in order:
 *   1. checks the approved Knowledge Base is ready, when the agent needs it;
 *   2. reads the settings and refuses when the monthly budget is empty or
 *      already reached (spend counted in Riyadh months);
 *   3. calls the provider: the mock when ANTHROPIC_API_KEY is unset, Claude
 *      otherwise;
 *   4. records the call in growth_ai_usage, which logs it to the audit trail
 *      with actor type 'ai' (refusals and failures included);
 *   5. sends the monthly budget alert once, when spend crosses the threshold.
 * A call that cannot be recorded is never made.
 */

import { sendEmail } from '@/lib/email/send';
import { isMissingSchema } from '@/lib/tools/db';

import { growthDb } from '../db';
import { getApprovedKnowledge } from '../kb';
import type { KbKind } from '../kbModel';
import { REAL_SETTINGS_ROW, getGrowthSettings } from '../settings';
import { DEFAULT_MODEL, budgetDecision, costUsd, crossedThreshold, riyadhMonth } from './pricing';
import { selectProvider, type AiMessage, type AiProvider } from './provider';

export type AiRefusal = 'kb_not_ready' | 'settings_unavailable' | 'no_budget' | 'budget_reached' | 'not_recorded' | 'unknown_model' | 'provider_error' | 'model_refused';

export type AiRequest = {
  /** Which agent is calling, e.g. 'signal-scout'. Shown in the audit log. */
  agent: string;
  /** What the call is for; also picks the mock's sample answer. */
  purpose: string;
  system?: string;
  messages: AiMessage[];
  model?: string;
  maxTokens?: number;
  related?: { companyId?: string | null; leadId?: string | null; kbItemId?: string | null };
  /**
   * Knowledge Base kinds that must have at least one approved item before the
   * agent may run, e.g. ['disallowed', 'messaging']. The layer always requires
   * the Knowledge Base to be readable unless `requireKnowledge` is false.
   */
  requireKnowledgeKinds?: KbKind[];
  requireKnowledge?: boolean;
  isTest?: boolean;
};

export type AiResult =
  | { ok: true; text: string; mock: boolean; model: string; inputTokens: number; outputTokens: number; costUsd: number; usageId: string }
  | { ok: false; reason: AiRefusal; message: string; mock: boolean; usageId: string | null };

export type BudgetAlertSender = (alert: { to: string; month: string; spentUsd: number; budgetUsd: number; thresholdPct: number }) => Promise<boolean>;

export type RunOptions = {
  /** Settings row to read limits from; verifiers use the test row. */
  settingsRowId?: number;
  now?: Date;
  provider?: AiProvider;
  alertSender?: BudgetAlertSender;
};

const MAX_TOKENS = 16000;

/** Spend this Riyadh month, real calls only, or test calls only. */
export async function monthSpend(opts: { isTest?: boolean; now?: Date } = {}): Promise<{ spentUsd: number; month: string; error: string | null }> {
  const month = riyadhMonth(opts.now);
  const { data, error } = await growthDb()
    .from('growth_ai_usage')
    .select('cost_usd')
    .eq('is_test', Boolean(opts.isTest))
    .gte('created_at', month.start.toISOString())
    .lt('created_at', month.end.toISOString());
  if (error) return { spentUsd: 0, month: month.key, error: isMissingSchema(error) ? 'The AI usage table is missing. Apply 087_growth_ai_usage.sql.' : error.message };
  const spent = ((data ?? []) as { cost_usd: number | string }[]).reduce((sum, r) => sum + Number(r.cost_usd), 0);
  return { spentUsd: Math.round(spent * 1e6) / 1e6, month: month.key, error: null };
}

export type AiCallRow = { id: string; created_at: string; agent: string; model: string; status: string; reason: string | null; is_mock: boolean; is_test: boolean; cost_usd: number | string };

/** The latest AI calls, newest first, for Growth Settings. Empty when the table is missing. */
export async function recentAiCalls(limit = 10): Promise<AiCallRow[]> {
  const { data } = await growthDb()
    .from('growth_ai_usage')
    .select('id, created_at, agent, model, status, reason, is_mock, is_test, cost_usd')
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data ?? []) as AiCallRow[];
}

type UsageRow = {
  agent: string;
  provider: 'mock' | 'anthropic';
  is_mock: boolean;
  model: string;
  input_tokens?: number;
  output_tokens?: number;
  cost_usd?: number;
  status: 'succeeded' | 'failed' | 'refused';
  reason?: string | null;
  duration_ms?: number | null;
  is_test: boolean;
  company_id?: string | null;
  lead_id?: string | null;
  kb_item_id?: string | null;
};

async function record(row: UsageRow): Promise<string | null> {
  const { data, error } = await growthDb().from('growth_ai_usage').insert(row).select('id').single();
  if (error) {
    console.error('[growth-ai] usage not recorded:', error.message);
    return null;
  }
  return (data as { id: string }).id;
}

/** The alert email: the Growth budget has crossed its threshold this month. */
export const emailBudgetAlert: BudgetAlertSender = async ({ to, month, spentUsd, budgetUsd, thresholdPct }) => {
  const res = await sendEmail({
    to,
    subject: `AI spend has reached ${thresholdPct}% of the ${month} budget`,
    html: `<p>Growth Engine AI spend for ${month} (Riyadh time) is USD ${spentUsd.toFixed(2)}, which is ${thresholdPct}% or more of the monthly budget of USD ${budgetUsd.toFixed(2)}.</p><p>AI calls stop when the budget is reached. You can change the budget in Growth Settings.</p>`,
  });
  return res.ok;
};

/**
 * Sends the month's alert at most once: the month is claimed by inserting its
 * row (unique on month and is_test), and only the successful claim sends. A
 * failed send deletes the claim so a later call can try again.
 */
export async function maybeSendBudgetAlert(input: {
  isTest: boolean;
  now?: Date;
  budgetUsd: number | null;
  thresholdPct: number;
  recipient: string;
  spentUsd: number;
  sender: BudgetAlertSender;
}): Promise<'not_due' | 'sent' | 'already_sent' | 'send_failed' | 'error'> {
  if (!crossedThreshold(input.budgetUsd, input.spentUsd, input.thresholdPct) || input.budgetUsd === null) return 'not_due';
  const month = riyadhMonth(input.now).key;
  const { data: claim, error } = await growthDb()
    .from('growth_ai_alerts')
    .insert({ is_test: input.isTest, month, threshold_pct: input.thresholdPct, budget_usd: input.budgetUsd, spent_usd: input.spentUsd, recipient: input.recipient })
    .select('id')
    .single();
  if (error) return error.code === '23505' ? 'already_sent' : 'error';
  const id = (claim as { id: string }).id;
  let sent = false;
  try {
    sent = await input.sender({ to: input.recipient, month, spentUsd: input.spentUsd, budgetUsd: input.budgetUsd, thresholdPct: input.thresholdPct });
  } catch {
    sent = false;
  }
  if (!sent) {
    await growthDb().from('growth_ai_alerts').delete().eq('id', id);
    return 'send_failed';
  }
  await growthDb().from('growth_ai_alerts').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', id);
  return 'sent';
}

export async function runAi(req: AiRequest, opts: RunOptions = {}): Promise<AiResult> {
  const provider = opts.provider ?? (await selectProvider());
  const isTest = Boolean(req.isTest);
  const model = provider.isMock ? 'mock' : req.model ?? DEFAULT_MODEL;
  const base = {
    agent: req.agent,
    provider: provider.name,
    is_mock: provider.isMock,
    model,
    is_test: isTest,
    company_id: req.related?.companyId ?? null,
    lead_id: req.related?.leadId ?? null,
    kb_item_id: req.related?.kbItemId ?? null,
  };
  const refuse = async (reason: AiRefusal, message: string): Promise<AiResult> => {
    const usageId = await record({ ...base, status: 'refused', reason: message });
    return { ok: false, reason, message, mock: provider.isMock, usageId };
  };

  // 1. The approved Knowledge Base.
  if (req.requireKnowledge !== false) {
    const kb = await getApprovedKnowledge({ includeTest: isTest }).catch(() => null);
    if (!kb || !kb.ready) return refuse('kb_not_ready', 'The approved Knowledge Base cannot be read, so the agent will not run.');
    const missing = (req.requireKnowledgeKinds ?? []).filter((k) => kb[k].length === 0);
    if (missing.length) return refuse('kb_not_ready', `The agent needs approved Knowledge Base items first: ${missing.join(', ')}.`);
  }

  // 2. Settings and budget.
  const settings = await getGrowthSettings(opts.settingsRowId ?? REAL_SETTINGS_ROW);
  if (settings.source !== 'database') return refuse('settings_unavailable', 'Growth Settings cannot be read, so no AI call is made.');
  const spend = await monthSpend({ isTest, now: opts.now });
  if (spend.error) return { ok: false, reason: 'not_recorded', message: spend.error, mock: provider.isMock, usageId: null };
  const budget = budgetDecision(settings.settings.ai_monthly_budget_usd, spend.spentUsd);
  if (!budget.ok) return refuse(budget.reason, budget.message);
  if (!provider.isMock && costUsd(model, { inputTokens: 0, outputTokens: 0 }) === null) {
    return refuse('unknown_model', `No price is known for ${model}, so it cannot be budgeted.`);
  }

  // 3. The call.
  const started = Date.now();
  let response;
  try {
    response = await provider.call({ model, system: req.system, messages: req.messages, maxTokens: req.maxTokens ?? MAX_TOKENS, purpose: req.purpose, agent: req.agent });
  } catch (err) {
    const message = err instanceof Error ? err.message.slice(0, 300) : 'The provider call failed';
    const usageId = await record({ ...base, status: 'failed', reason: message, duration_ms: Date.now() - started });
    return { ok: false, reason: 'provider_error', message, mock: provider.isMock, usageId };
  }
  const tokens = { inputTokens: response.inputTokens, outputTokens: response.outputTokens, cacheWriteTokens: response.cacheWriteTokens, cacheReadTokens: response.cacheReadTokens };
  const cost = provider.isMock ? 0 : costUsd(response.model, tokens) ?? costUsd(model, tokens) ?? 0;

  // 4. The record, which also writes the audit log.
  const row: UsageRow = {
    ...base,
    model: response.model,
    input_tokens: response.inputTokens + response.cacheWriteTokens + response.cacheReadTokens,
    output_tokens: response.outputTokens,
    cost_usd: cost,
    status: response.refused ? 'refused' : 'succeeded',
    reason: response.refused ? 'The model declined the request' : null,
    duration_ms: Date.now() - started,
  };
  const usageId = await record(row);
  if (!usageId) return { ok: false, reason: 'not_recorded', message: 'The call could not be recorded, so its result is not used.', mock: provider.isMock, usageId: null };

  // 5. The monthly alert.
  if (cost > 0 || isTest) {
    const after = await monthSpend({ isTest, now: opts.now });
    if (!after.error) {
      const sender = opts.alertSender ?? (isTest ? async () => true : emailBudgetAlert);
      await maybeSendBudgetAlert({
        isTest,
        now: opts.now,
        budgetUsd: settings.settings.ai_monthly_budget_usd,
        thresholdPct: settings.settings.ai_alert_threshold_pct,
        recipient: settings.settings.ai_alert_email,
        spentUsd: after.spentUsd,
        sender,
      });
    }
  }

  if (response.refused) return { ok: false, reason: 'model_refused', message: 'The model declined the request.', mock: provider.isMock, usageId };
  return { ok: true, text: response.text, mock: provider.isMock, model: response.model, inputTokens: row.input_tokens ?? 0, outputTokens: response.outputTokens, costUsd: cost, usageId };
}
