/**
 * The daily signal feed (Unit 2.6, 2026-09-23; reworked 2026-10-29). Server only.
 *
 * Each morning (Riyadh time) the Growth cron asks the signal-feed agent to
 * search for new trigger events matching the keyword library Ahmad manages in
 * Settings (keywords.ts). A run makes one AI call per active keyword group,
 * each with its own search allowance (`signal_feed_searches_per_group`), so
 * every group gets real coverage instead of 115 keywords sharing ten
 * searches. Calls run five at a time; a call starts only while the run's
 * spend plus its estimate stays within `signal_feed_max_cost_usd`, and no new
 * round starts late in the function's time. Groups rotate daily, so one left
 * out runs early another day. Every group left out is recorded on the run.
 *
 * The model returns its findings by calling the `report_signals` tool, whose
 * input the API checks against a schema (feedModel.ts); text is only a
 * fallback, read robustly. Each call records its parse outcome (no JSON,
 * invalid JSON, no signals list, an empty list, or a count of candidates),
 * its searches and returned URLs, its stop reasons, and the raw answer, cut
 * to a readable length. So "found nothing" is never confused with "could not
 * read the answer".
 *
 * Each signal names the keyword it matched; the keyword's trigger type
 * becomes the signal's suggested trigger, which Ahmad can change in the
 * inbox. A signal is kept only with a real evidence link that the search
 * actually returned, dated inside the window (`signal_feed_window_days`, the
 * same number the prompt states). The same event found twice in one run is
 * kept once, and duplicates of signals already in the inbox are skipped. At
 * most `signal_feed_max_per_run` are kept. The AI budget applies through
 * runAi, like every call.
 *
 * Scheduled runs happen at most once a Riyadh day (a unique key on the run
 * date), only on the weekdays ticked in `signal_feed_days` (114, default
 * Sunday, Tuesday and Thursday), and not while the feed is paused or in mock
 * mode. Before any real run, its expected cost (the average of recent runs,
 * or the estimate before there are any) is checked against what is left of
 * the month's AI budget: a run that would go over is skipped and recorded as
 * refused with the reason, so the Signals screen says so; a run that fits has
 * its ceiling lowered to what is left. A manual run is always
 * allowed, but while paused or in mock mode it is a preview and saves no
 * signals.
 */

import { logActivity } from './activity';
import { isMockMode } from './ai/provider';
import { monthSpend, runAi } from './ai/run';
import type { WriteResult } from './api';
import { growthDb, tableExists } from './db';
import { getEngineSettings, pendingMigration } from './engineSettings';
import {
  budgetAllowsRun,
  costBasis,
  morningDaySkip,
  type FeedCostBasis,
  FEED_CALL_TIMEOUT_MS,
  FEED_CONCURRENCY,
  FEED_TIME_BUDGET_MS,
  estimateGroupCostUsd,
  feedResultTool,
  oldestAllowed,
  readFeedAnswer,
  rotateGroups,
  summarizeOutcomes,
  withinCeiling,
  type ParseOutcome,
} from './feedModel';
import { riyadhDate } from './format';
import type { Actor } from './kb';
import { GCC_PLACES, suggestKeyword } from './keywordLibrary';
import { activeKeywords, ensureSeeded, getKeywordLibrary } from './keywords';
import { TRIGGER_TYPES, type TriggerType } from './model';
import { getGrowthSettings } from './settings';
import { createSignal, existingDuplicate } from './signals';
import { companyNameKey, evidenceKey, isRealEvidenceUrl } from './signalsModel';

export const FEED_AGENT = 'signal-feed';
/** The default date window; the setting `signal_feed_window_days` (113) overrides it. */
export const FEED_MAX_AGE_DAYS = 30;
/** How much of each answer the run keeps for diagnosis. */
const RAW_TEXT_CHARS = 4000;
const RAW_TOOL_CHARS = 8000;

export type FeedCandidate = {
  company_name: string;
  trigger_type: TriggerType;
  signal_date: string;
  summary: string;
  evidence_url: string;
  source_name: string | null;
  keyword_number?: number | null;
  matched_keyword?: string | null;
  matched_keyword_id?: string | null;
};
export type FeedDecision = FeedCandidate & { outcome: 'kept' | 'duplicate' | 'discarded' | 'over_limit'; why: string; group?: string };

/** A keyword as the feed numbers it in the prompt. `id` is null before the library is saved, and for the old list before 094. */
export type FeedKeyword = { id: string | null; keyword: string; trigger: TriggerType | null; region: 'ksa' | 'gcc' };
/** One AI call's worth of keywords: an active library group, or the old list as one group. */
export type FeedGroup = { key: string; label: string; keywords: FeedKeyword[] };

/**
 * Checks what the agent returned. Pure: the verifier runs it directly. A
 * candidate is discarded without a real evidence link the search returned,
 * with an unreadable or future date, one older than the window, or with no
 * company or summary.
 */
export function screenCandidates(raw: unknown, opts: { sourceUrls: string[]; mock: boolean; today: string; maxAgeDays?: number }): { valid: FeedCandidate[]; discarded: FeedDecision[] } {
  const list = raw && typeof raw === 'object' && Array.isArray((raw as { signals?: unknown }).signals) ? ((raw as { signals: unknown[] }).signals as Record<string, unknown>[]) : [];
  const allowed = new Set(opts.sourceUrls);
  const triggers = TRIGGER_TYPES.map((t) => t.value) as string[];
  const valid: FeedCandidate[] = [];
  const discarded: FeedDecision[] = [];
  const maxAge = opts.maxAgeDays ?? FEED_MAX_AGE_DAYS;
  const oldest = oldestAllowed(opts.today, maxAge);
  for (const s of list.slice(0, 100)) {
    if (!s || typeof s !== 'object') continue;
    const n = Number(s.keyword_number);
    const c: FeedCandidate = {
      company_name: String(s.company_name ?? '').trim().slice(0, 200),
      trigger_type: (triggers.includes(String(s.trigger_type)) ? s.trigger_type : 'other') as TriggerType,
      signal_date: String(s.signal_date ?? '').slice(0, 10),
      summary: String(s.summary ?? '').trim().slice(0, 1000),
      evidence_url: String(s.evidence_url ?? '').trim(),
      source_name: s.source_name ? String(s.source_name).trim().slice(0, 120) : null,
      keyword_number: Number.isInteger(n) && n > 0 ? n : null,
    };
    let why = '';
    if (!c.evidence_url) why = 'no evidence link';
    else if (!opts.mock && !isRealEvidenceUrl(c.evidence_url)) why = 'the evidence link is not a real page';
    else if (!allowed.has(c.evidence_url)) why = 'the evidence link was not returned by the search';
    else if (!c.company_name) why = 'no company named';
    else if (c.summary.length < 10) why = 'no usable summary';
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(c.signal_date) || Number.isNaN(Date.parse(c.signal_date))) why = 'no readable date';
    else if (c.signal_date > opts.today) why = 'dated in the future';
    else if (c.signal_date < oldest) why = `older than ${maxAge} days`;
    if (why) discarded.push({ ...c, outcome: 'discarded', why });
    else valid.push(c);
  }
  return { valid, discarded };
}

/**
 * The keyword each candidate matched, and the trigger it suggests. Pure. The
 * agent names a keyword by its number; when it names none, or a number out of
 * range, the text is matched against the keywords instead. A matched keyword
 * with a trigger type sets the candidate's trigger.
 */
export function assignKeywords(valid: FeedCandidate[], keywords: FeedKeyword[]): FeedCandidate[] {
  const matchable = keywords.map((k, i) => ({ id: String(i), keyword: k.keyword, trigger: (k.trigger ?? 'other') as TriggerType, enabled: true, index: i }));
  return valid.map((c) => {
    let idx = c.keyword_number && c.keyword_number <= keywords.length ? c.keyword_number - 1 : -1;
    if (idx < 0) idx = suggestKeyword(`${c.company_name} ${c.summary}`, matchable)?.index ?? -1;
    if (idx < 0) return { ...c, matched_keyword: null, matched_keyword_id: null };
    const k = keywords[idx];
    return { ...c, trigger_type: k.trigger ?? c.trigger_type, matched_keyword: k.keyword, matched_keyword_id: k.id };
  });
}

/** The same event found twice in one run (same evidence link, or same company, trigger and date) is kept once. Pure. */
export function dedupeWithinRun(valid: FeedCandidate[]): { unique: FeedCandidate[]; repeats: FeedDecision[] } {
  const seen = new Set<string>();
  const unique: FeedCandidate[] = [];
  const repeats: FeedDecision[] = [];
  for (const c of valid) {
    const keys = [`e:${evidenceKey(c.evidence_url) ?? c.evidence_url}`, `c:${companyNameKey(c.company_name)}|${c.trigger_type}|${c.signal_date}`];
    if (keys.some((k) => seen.has(k))) {
      repeats.push({ ...c, outcome: 'duplicate', why: 'found twice in this run' });
      continue;
    }
    keys.forEach((k) => seen.add(k));
    unique.push(c);
  }
  return { unique, repeats };
}

/** The prompt for one group's call. Pure. The window it states is the one `screenCandidates` enforces. */
export function feedPrompt(keywords: FeedKeyword[], today: string, opts: { windowDays?: number; searches?: number; groupLabel?: string } = {}): { system: string; user: string } {
  const gcc = keywords.some((k) => k.region === 'gcc');
  const windowDays = opts.windowDays ?? FEED_MAX_AGE_DAYS;
  const tool = feedResultTool().name;
  return {
    system: [
      'You find trigger events that suggest a company in Saudi Arabia or the wider GCC may need corporate finance or transaction advisory: new projects, off-plan registrations, fundraising or debt, market entry, finance leadership hires, contract awards, acquisitions or joint ventures, capital market activity, and expansions.',
      `Use web search. Report only events published in the last ${windowDays} days (on or after ${oldestAllowed(today, windowDays)}) that match at least one of the numbered keywords. For each event give keyword_number: the number of the keyword it best matches.`,
      opts.searches ? `You have ${opts.searches} searches. Spread them across the keywords, combining closely related keywords in one query, and prefer business news, official announcements and exchange filings.` : '',
      gcc ? `Where a keyword says GCC, it means any of: ${GCC_PLACES.join(', ')}.` : '',
      'Every event must have an evidence_url: the exact URL of the article or filing you read, as returned by your search. Never construct, shorten or guess a URL. If you cannot give one, leave the event out.',
      'Report each event once, even if it matches several keywords. Never invent companies, people, amounts or dates. Summaries are one or two plain sentences stating what the source says.',
      `Trigger types: ${TRIGGER_TYPES.map((t) => t.value).join(', ')}.`,
      `When you have finished searching, call the ${tool} tool once with every event you found, or with an empty signals list if none qualify. Do not write the results as text.`,
    ]
      .filter(Boolean)
      .join('\n'),
    user: `Today is ${today} (Riyadh).${opts.groupLabel ? ` Keyword group: ${opts.groupLabel}.` : ''} Keywords:\n${keywords.map((k, i) => `${i + 1}. ${k.keyword}${k.trigger ? ` [${k.trigger}]` : ''}`).join('\n')}`,
  };
}

/** The keywords the feed searches, by group: the library's active ones, or the old list in Settings before 094. */
async function loadFeedGroups(opts: { seed: boolean; legacy: string[] }): Promise<{ groups: FeedGroup[]; source: 'library' | 'legacy' }> {
  let lib = await getKeywordLibrary();
  if (lib.source === 'pending') {
    const keywords = opts.legacy.map((k) => ({ id: null, keyword: k, trigger: null, region: 'ksa' as const }));
    return { groups: keywords.length ? [{ key: 'legacy', label: 'Keywords', keywords }] : [], source: 'legacy' };
  }
  // A run that saves signals needs saved keyword ids, so the defaults are saved first.
  if (opts.seed && lib.source === 'defaults') {
    const seeded = await ensureSeeded(null);
    if (seeded.ok) lib = await getKeywordLibrary();
  }
  const saved = lib.source === 'database';
  const active = activeKeywords(lib);
  const groups = lib.groups
    .map((g) => ({ key: g.key, label: g.label, keywords: active.filter((k) => k.group === g.key).map((k) => ({ id: saved ? k.id : null, keyword: k.keyword, trigger: k.trigger, region: k.region })) }))
    .filter((g) => g.keywords.length > 0);
  return { groups, source: 'library' };
}

/** What one group's call did, kept on the run for diagnosis. */
export type FeedCall = {
  group: string;
  label: string;
  keywords: number;
  status: 'completed' | 'refused';
  outcome: ParseOutcome | null;
  message?: string;
  searches: number;
  source_urls: number;
  stop_reasons: string[];
  requests: number;
  cost_usd: number;
  usage_id: string | null;
  raw_text: string;
  raw_tool_input: string | null;
};
export type FeedSkip = { group: string; label: string; why: 'cost_ceiling' | 'time_limit' };

export type FeedRunResult = {
  runId: string | null;
  mode: 'real' | 'mock_preview';
  /** True when nothing could be saved: mock mode, or the feed is paused. */
  previewOnly: boolean;
  status: 'completed' | 'refused' | 'skipped';
  message: string;
  decisions: FeedDecision[];
  saved: number;
  /** How the answers read, e.g. "9 answers read: 23 candidates from 7 groups; 2 found nothing". */
  parse?: string;
  searches?: number;
  costUsd?: number;
  groupsRun?: number;
  groupsTotal?: number;
};

const round2 = (n: number) => Math.round(n * 100) / 100;
const usd = (n: number) => `USD ${n.toFixed(2)}`;

export async function runSignalFeed(opts: { trigger: 'cron' | 'manual'; actor?: Actor | null; isTest?: boolean; now?: Date }): Promise<WriteResult<FeedRunResult>> {
  const started = Date.now();
  const today = riyadhDate(opts.now);
  const mock = isMockMode();
  const isTest = Boolean(opts.isTest);
  const engine = await getEngineSettings();
  const pending = pendingMigration(engine, ['signal_keywords', 'signal_feed_paused', 'signal_feed_max_per_run']);
  if (engine.source !== 'database') return { ok: false, status: 503, error: 'Growth Settings cannot be read, so the feed does not run.' };
  if (pending || !(await tableExists('growth_feed_runs'))) return { ok: false, status: 503, error: `The signal feed needs ${pending ?? '088_growth_prospecting.sql'} applied first.` };
  // The coverage settings (113) fall back to their defaults until 113 is applied: the window, five searches a group and a USD 3.00 ceiling.
  const { signal_feed_paused: paused, signal_feed_max_per_run: max, signal_feed_window_days: windowDays, signal_feed_searches_per_group: searches, signal_feed_max_cost_usd: ceiling, signal_feed_days: days } = engine.values;
  const previewOnly = mock || paused;
  const skip = (message: string): WriteResult<FeedRunResult> => ({ ok: true, value: { runId: null, mode: mock ? 'mock_preview' : 'real', previewOnly, status: 'skipped', message, decisions: [], saved: 0 } });
  if (opts.trigger === 'cron' && paused) return skip('The feed is paused in Settings.');
  if (opts.trigger === 'cron' && mock) return skip('Mock mode: the morning run only happens with an Anthropic key. Run it by hand for a labelled preview.');
  const notToday = morningDaySkip(opts.trigger, days, opts.now);
  if (notToday) return skip(notToday);
  const { groups: allGroups, source: keywordSource } = await loadFeedGroups({ seed: !previewOnly, legacy: engine.values.signal_keywords });
  if (!allGroups.length) return skip('No keywords are switched on. Choose them in Growth Settings.');
  const groups = rotateGroups(allGroups, today);

  const { data: run, error } = await growthDb()
    .from('growth_feed_runs')
    .insert({ is_test: isTest, trigger: opts.trigger, run_date: today, mode: mock ? 'mock_preview' : 'real', keywords: groups.flatMap((g) => g.keywords.map((k) => k.keyword)), created_by_name: opts.actor?.name ?? 'Growth cron' })
    .select('id')
    .single();
  if (error) {
    if (error.code === '23505') return skip(`The morning run for ${today} has already happened.`);
    return { ok: false, status: 500, error: error.message };
  }
  const runId = (run as { id: string }).id;
  const finish = async (patch: Record<string, unknown>) => growthDb().from('growth_feed_runs').update({ ...patch, finished_at: new Date().toISOString() }).eq('id', runId);

  // The month's budget: skip a run that would go over it, and keep a run that fits within what is left.
  let runCeiling = ceiling;
  if (!mock) {
    const [growth, spend, basis] = await Promise.all([getGrowthSettings(), monthSpend({ isTest, now: opts.now }), feedCostBasis({ groups: allGroups.length, searches, isTest })]);
    const budget = growth.source === 'database' ? growth.settings.ai_monthly_budget_usd : null;
    const expected = round2(Math.min(basis.perRunUsd, ceiling));
    if (!spend.error && budget !== null && budget > 0) {
      if (!budgetAllowsRun(spend.spentUsd, expected, budget)) {
        const how = basis.basis === 'measured' ? `average of the last ${basis.runs} ${basis.runs === 1 ? 'run' : 'runs'}` : 'estimate';
        const message = `Skipped: this run would cost about ${usd(expected)} (${how}) and take this month's AI spend, ${usd(spend.spentUsd)} so far, over the ${usd(budget)} budget. Raise the budget in Growth Settings, or the feed resumes next month.`;
        await finish({ status: 'refused', detail: { reason: 'budget', message, spent_usd: spend.spentUsd, budget_usd: budget, expected_usd: expected, basis: basis.basis, cost_usd: 0, searches: 0 } });
        await logActivity({ actorType: 'ai', actorId: FEED_AGENT, action: 'feed.skipped', summary: message, isTest, metadata: { run_id: runId, trigger: opts.trigger } });
        return { ok: true, value: { runId, mode: 'real', previewOnly, status: 'refused', message, decisions: [], saved: 0, searches: 0, costUsd: 0, groupsRun: 0, groupsTotal: allGroups.length } };
      }
      runCeiling = Math.min(ceiling, round2(budget - spend.spentUsd));
    }
  }

  // One call per group, FEED_CONCURRENCY at a time, inside the cost ceiling and the time limit.
  const tool = feedResultTool();
  const calls: FeedCall[] = [];
  const skipped: FeedSkip[] = [];
  const valid: FeedCandidate[] = [];
  const discarded: FeedDecision[] = [];
  let spent = 0;
  let dearest = 0;
  for (let i = 0; i < groups.length; i += FEED_CONCURRENCY) {
    const round = groups.slice(i, i + FEED_CONCURRENCY);
    if (i > 0 && Date.now() - started > FEED_TIME_BUDGET_MS) {
      skipped.push(...round.map((g) => ({ group: g.key, label: g.label, why: 'time_limit' as const })));
      continue;
    }
    const go: FeedGroup[] = [];
    let committed = 0;
    for (const g of round) {
      // The estimate is the larger of the per-search figure and the dearest call so far this run.
      const estimate = mock ? 0 : Math.max(estimateGroupCostUsd(searches), dearest);
      if (!withinCeiling(spent, committed, estimate, runCeiling)) skipped.push({ group: g.key, label: g.label, why: 'cost_ceiling' });
      else {
        committed += estimate;
        go.push(g);
      }
    }
    const results = await Promise.all(
      go.map(async (g) => {
        const p = feedPrompt(g.keywords, today, { windowDays, searches, groupLabel: g.label });
        const ai = await runAi({ agent: FEED_AGENT, purpose: 'signal_feed', system: p.system, messages: [{ role: 'user', content: p.user }], webSearch: { maxUses: searches }, resultTool: tool, timeoutMs: FEED_CALL_TIMEOUT_MS, maxTokens: 8000, isTest });
        return { g, ai };
      }),
    );
    for (const { g, ai } of results) {
      if (!ai.ok) {
        calls.push({ group: g.key, label: g.label, keywords: g.keywords.length, status: 'refused', outcome: null, message: ai.message, searches: 0, source_urls: 0, stop_reasons: [], requests: 0, cost_usd: 0, usage_id: ai.usageId, raw_text: '', raw_tool_input: null });
        continue;
      }
      spent = round2(spent + ai.costUsd);
      dearest = Math.max(dearest, ai.costUsd);
      const read = readFeedAnswer({ toolInput: ai.toolInput, text: ai.text });
      const screened = screenCandidates(read.value, { sourceUrls: ai.sourceUrls, mock: ai.mock, today, maxAgeDays: windowDays });
      valid.push(...assignKeywords(screened.valid, g.keywords));
      discarded.push(...screened.discarded.map((d) => ({ ...d, group: g.label })));
      calls.push({
        group: g.key,
        label: g.label,
        keywords: g.keywords.length,
        status: 'completed',
        outcome: read.outcome,
        searches: ai.webSearchRequests,
        source_urls: ai.sourceUrls.length,
        stop_reasons: ai.stopReasons,
        requests: ai.requests,
        cost_usd: ai.costUsd,
        usage_id: ai.usageId,
        raw_text: ai.text.slice(0, RAW_TEXT_CHARS),
        raw_tool_input: ai.toolInput === undefined ? null : JSON.stringify(ai.toolInput).slice(0, RAW_TOOL_CHARS),
      });
    }
  }

  const done = calls.filter((c) => c.status === 'completed');
  const searchesRun = calls.reduce((a, c) => a + c.searches, 0);
  const parse = summarizeOutcomes(done.map((c) => c.outcome as ParseOutcome));
  const skippedLine = skipped.length ? ` ${skipped.length} ${skipped.length === 1 ? 'group was' : 'groups were'} left out (${[...new Set(skipped.map((s) => (s.why === 'cost_ceiling' ? `the ${usd(runCeiling)} ceiling` : 'the time limit')))].join(', ')}).` : '';
  const coverage = `Searched ${done.length} of ${allGroups.length} keyword groups: ${searchesRun} searches, ${usd(spent)}.${skippedLine}`;
  const detailBase = { mock, preview_only: previewOnly, paused, keyword_source: keywordSource, window_days: windowDays, searches_per_group: searches, max_cost_usd: runCeiling, cost_usd: spent, searches: searchesRun, source_urls: calls.reduce((a, c) => a + c.source_urls, 0), parse_summary: parse, calls, skipped };

  if (!done.length) {
    const reason = calls.find((c) => c.message)?.message ?? 'No group could be searched within the cost ceiling.';
    await finish({ status: 'refused', usage_id: calls[0]?.usage_id ?? null, detail: { ...detailBase, reason } });
    return { ok: true, value: { runId, mode: mock ? 'mock_preview' : 'real', previewOnly, status: 'refused', message: reason, decisions: [], saved: 0, parse, searches: searchesRun, costUsd: spent, groupsRun: 0, groupsTotal: allGroups.length } };
  }

  const { unique, repeats } = dedupeWithinRun(valid);
  const decisions: FeedDecision[] = [...discarded, ...repeats];
  const noSave = mock || paused;
  let saved = 0;
  let duplicates = repeats.length;
  for (const c of unique) {
    const dup = await existingDuplicate({ company_id: null, company_name: c.company_name, trigger_type: c.trigger_type, signal_date: c.signal_date, evidence_url: c.evidence_url });
    if (dup) {
      duplicates++;
      decisions.push({ ...c, outcome: 'duplicate', why: 'already in the inbox' });
      continue;
    }
    if (saved >= max) {
      decisions.push({ ...c, outcome: 'over_limit', why: `the run keeps at most ${max}` });
      continue;
    }
    if (noSave) {
      // Mock mode and a paused feed preview only: nothing is saved as a signal.
      decisions.push({ ...c, outcome: 'kept', why: 'would be kept (preview only)' });
      continue;
    }
    const r = await createSignal(
      { company_name: c.company_name, trigger_type: c.trigger_type, signal_date: c.signal_date, summary: c.summary, evidence_url: c.evidence_url, source_name: c.source_name, company_id: null },
      null,
      { origin: 'feed', feedRunId: runId, isTest, actorType: 'ai', actorId: FEED_AGENT, matchedKeyword: c.matched_keyword ? { id: c.matched_keyword_id ?? null, keyword: c.matched_keyword } : null },
    );
    if (r.ok) {
      saved++;
      decisions.push({ ...c, outcome: 'kept', why: 'added to the inbox' });
    } else decisions.push({ ...c, outcome: 'discarded', why: r.error });
  }

  const found = valid.length + discarded.length;
  await finish({ status: 'completed', found, saved, duplicates, discarded: discarded.length, usage_id: done[0].usage_id, detail: { ...detailBase, decisions: decisions.slice(0, 200) } });
  await logActivity({
    actorType: 'ai',
    actorId: FEED_AGENT,
    action: 'feed.run',
    summary: `${mock ? 'Mock preview of the signal feed' : paused ? 'Preview of the paused signal feed' : 'Signal feed'}: ${saved} kept, ${duplicates} duplicates skipped, ${discarded.length} discarded without evidence or date. ${parse}. ${coverage}`,
    isTest,
    metadata: { run_id: runId, trigger: opts.trigger, mock, preview_only: noSave, cost_usd: spent, searches: searchesRun },
  });
  const head = mock
    ? 'Mock preview: nothing was saved. With an Anthropic key the same run adds real signals.'
    : paused
      ? 'Preview: the feed is paused, so nothing was saved. Switch it on in Settings to add signals.'
      : `${saved} signals added to the inbox.`;
  const message = `${head} ${parse}. ${coverage}`;
  return { ok: true, value: { runId, mode: mock ? 'mock_preview' : 'real', previewOnly: noSave, status: 'completed', message, decisions, saved, parse, searches: searchesRun, costUsd: spent, groupsRun: done.length, groupsTotal: allGroups.length } };
}

export type FeedRunRow = { id: string; created_at: string; trigger: string; run_date: string; mode: string; status: string; found: number; saved: number; duplicates: number; discarded: number; is_test: boolean; detail: Record<string, unknown>; usage_id?: string | null; cost_usd: number | null };

/**
 * The latest runs, each with its actual cost: the run's own total, or for a
 * run from before 2026-10-29 the cost of its one AI call.
 */
export async function recentFeedRuns(limit = 5): Promise<FeedRunRow[]> {
  const { data } = await growthDb().from('growth_feed_runs').select('*').order('created_at', { ascending: false }).limit(limit);
  const rows = (data ?? []) as Omit<FeedRunRow, 'cost_usd'>[];
  const own = (r: Omit<FeedRunRow, 'cost_usd'>) => (typeof r.detail?.cost_usd === 'number' ? (r.detail.cost_usd as number) : null);
  const ids = rows.filter((r) => own(r) === null && r.usage_id).map((r) => r.usage_id as string);
  const costs = new Map<string, number>();
  if (ids.length) {
    const { data: usage } = await growthDb().from('growth_ai_usage').select('id, cost_usd').in('id', ids);
    for (const u of (usage ?? []) as { id: string; cost_usd: number | string }[]) costs.set(u.id, Number(u.cost_usd));
  }
  return rows.map((r) => ({ ...r, cost_usd: own(r) ?? (r.usage_id ? (costs.get(r.usage_id) ?? null) : null) }));
}

/**
 * What a run is expected to cost, for the budget check and the Settings
 * projection: the average of the last five completed real runs made one call
 * per group (since 2026-10-29), else the estimate for every group.
 */
export async function feedCostBasis(opts: { groups: number; searches: number; isTest?: boolean }): Promise<FeedCostBasis> {
  const { data } = await growthDb()
    .from('growth_feed_runs')
    .select('detail')
    .eq('is_test', Boolean(opts.isTest))
    .eq('mode', 'real')
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(20);
  const costs = ((data ?? []) as { detail: Record<string, unknown> | null }[])
    .filter((r) => Array.isArray(r.detail?.calls) && typeof r.detail?.cost_usd === 'number')
    .slice(0, 5)
    .map((r) => r.detail!.cost_usd as number);
  return costBasis(costs, opts.groups, opts.searches);
}
