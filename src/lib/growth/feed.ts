/**
 * The daily signal feed (Unit 2.6, 2026-09-23). Server only.
 *
 * Each morning (Riyadh time) the Growth cron asks the signal-feed agent to
 * search for new trigger events matching the keyword library Ahmad manages in
 * Settings (keywords.ts). Each signal names the keyword it matched; the
 * keyword's trigger type becomes the signal's suggested trigger, which Ahmad
 * can change in the inbox. A signal is kept only with a real evidence link
 * that the search actually returned; one without is discarded. The same event
 * found twice in one run is kept once, and duplicates of signals already in
 * the inbox are skipped. At most `signal_feed_max_per_run` are kept. The AI
 * budget applies through runAi, like every call.
 *
 * Scheduled runs happen once a Riyadh day (a unique key on the run date), and
 * do not run while the feed is paused or in mock mode. A manual run is always
 * allowed, but while paused or in mock mode it is a preview and saves no
 * signals.
 */

import { logActivity } from './activity';
import { isMockMode } from './ai/provider';
import { runAi } from './ai/run';
import type { WriteResult } from './api';
import { growthDb, tableExists } from './db';
import { getEngineSettings, pendingMigration } from './engineSettings';
import { riyadhDate } from './format';
import type { Actor } from './kb';
import { GCC_PLACES, suggestKeyword } from './keywordLibrary';
import { activeKeywords, ensureSeeded, getKeywordLibrary } from './keywords';
import { TRIGGER_TYPES, type TriggerType } from './model';
import { createSignal, existingDuplicate } from './signals';
import { companyNameKey, evidenceKey, isRealEvidenceUrl } from './signalsModel';
import { extractJsonObject } from './agents/json';

export const FEED_AGENT = 'signal-feed';
/** Signals older than this are not news and are discarded. */
export const FEED_MAX_AGE_DAYS = 30;

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
export type FeedDecision = FeedCandidate & { outcome: 'kept' | 'duplicate' | 'discarded' | 'over_limit'; why: string };

/** A keyword as the feed numbers it in the prompt. `id` is null before the library is saved, and for the old list before 094. */
export type FeedKeyword = { id: string | null; keyword: string; trigger: TriggerType | null; region: 'ksa' | 'gcc' };

/**
 * Checks what the agent returned. Pure: the verifier runs it directly. A
 * candidate is discarded without a real evidence link the search returned,
 * with an unreadable or future or stale date, or with no company or summary.
 */
export function screenCandidates(raw: unknown, opts: { sourceUrls: string[]; mock: boolean; today: string }): { valid: FeedCandidate[]; discarded: FeedDecision[] } {
  const list = raw && typeof raw === 'object' && Array.isArray((raw as { signals?: unknown }).signals) ? ((raw as { signals: unknown[] }).signals as Record<string, unknown>[]) : [];
  const allowed = new Set(opts.sourceUrls);
  const triggers = TRIGGER_TYPES.map((t) => t.value) as string[];
  const valid: FeedCandidate[] = [];
  const discarded: FeedDecision[] = [];
  const oldest = new Date(Date.parse(`${opts.today}T00:00:00Z`) - FEED_MAX_AGE_DAYS * 86_400_000).toISOString().slice(0, 10);
  for (const s of list.slice(0, 100)) {
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
    else if (c.signal_date < oldest) why = `older than ${FEED_MAX_AGE_DAYS} days`;
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

export function feedPrompt(keywords: FeedKeyword[], today: string): { system: string; user: string } {
  const gcc = keywords.some((k) => k.region === 'gcc');
  return {
    system: [
      'You find trigger events that suggest a company in Saudi Arabia or the wider GCC may need corporate finance or transaction advisory: new projects, off-plan registrations, fundraising or debt, market entry, finance leadership hires, contract awards, acquisitions or joint ventures, capital market activity, and expansions.',
      'Use web search. Report only events published in the last 7 days that match at least one of the numbered keywords. For each event give keyword_number: the number of the keyword it best matches.',
      gcc ? `Where a keyword says GCC, it means any of: ${GCC_PLACES.join(', ')}.` : '',
      'Every event must have an evidence_url: the exact URL of the article or filing you read, as returned by your search. Never construct, shorten or guess a URL. If you cannot give one, leave the event out.',
      'Report each event once, even if it matches several keywords. Never invent companies, people, amounts or dates. Summaries are one or two plain sentences stating what the source says.',
      `Trigger types: ${TRIGGER_TYPES.map((t) => t.value).join(', ')}.`,
      'Answer with one JSON object and nothing else: {"signals":[{"company_name":string,"trigger_type":string,"signal_date":"YYYY-MM-DD","summary":string,"evidence_url":string,"source_name":string,"keyword_number":number}]}',
    ]
      .filter(Boolean)
      .join('\n'),
    user: `Today is ${today} (Riyadh). Keywords:\n${keywords.map((k, i) => `${i + 1}. ${k.keyword}${k.trigger ? ` [${k.trigger}]` : ''}`).join('\n')}`,
  };
}

/** The keywords the feed searches: the library's active ones, or the old list in Settings before 094. */
async function loadFeedKeywords(opts: { seed: boolean; legacy: string[] }): Promise<{ keywords: FeedKeyword[]; source: 'library' | 'legacy' }> {
  let lib = await getKeywordLibrary();
  if (lib.source === 'pending') return { keywords: opts.legacy.map((k) => ({ id: null, keyword: k, trigger: null, region: 'ksa' as const })), source: 'legacy' };
  // A run that saves signals needs saved keyword ids, so the defaults are saved first.
  if (opts.seed && lib.source === 'defaults') {
    const seeded = await ensureSeeded(null);
    if (seeded.ok) lib = await getKeywordLibrary();
  }
  const saved = lib.source === 'database';
  return { keywords: activeKeywords(lib).map((k) => ({ id: saved ? k.id : null, keyword: k.keyword, trigger: k.trigger, region: k.region })), source: 'library' };
}

export type FeedRunResult = {
  runId: string | null;
  mode: 'real' | 'mock_preview';
  /** True when nothing could be saved: mock mode, or the feed is paused. */
  previewOnly: boolean;
  status: 'completed' | 'refused' | 'skipped';
  message: string;
  decisions: FeedDecision[];
  saved: number;
};

export async function runSignalFeed(opts: { trigger: 'cron' | 'manual'; actor?: Actor | null; isTest?: boolean; now?: Date }): Promise<WriteResult<FeedRunResult>> {
  const today = riyadhDate(opts.now);
  const mock = isMockMode();
  const isTest = Boolean(opts.isTest);
  const engine = await getEngineSettings();
  const pending = pendingMigration(engine, ['signal_keywords', 'signal_feed_paused', 'signal_feed_max_per_run']);
  if (engine.source !== 'database') return { ok: false, status: 503, error: 'Growth Settings cannot be read, so the feed does not run.' };
  if (pending || !(await tableExists('growth_feed_runs'))) return { ok: false, status: 503, error: `The signal feed needs ${pending ?? '088_growth_prospecting.sql'} applied first.` };
  const { signal_feed_paused: paused, signal_feed_max_per_run: max } = engine.values;
  const previewOnly = mock || paused;
  const skip = (message: string): WriteResult<FeedRunResult> => ({ ok: true, value: { runId: null, mode: mock ? 'mock_preview' : 'real', previewOnly, status: 'skipped', message, decisions: [], saved: 0 } });
  if (opts.trigger === 'cron' && paused) return skip('The feed is paused in Settings.');
  if (opts.trigger === 'cron' && mock) return skip('Mock mode: the morning run only happens with an Anthropic key. Run it by hand for a labelled preview.');
  const { keywords, source: keywordSource } = await loadFeedKeywords({ seed: !previewOnly, legacy: engine.values.signal_keywords });
  if (!keywords.length) return skip('No keywords are switched on. Choose them in Growth Settings.');

  const { data: run, error } = await growthDb()
    .from('growth_feed_runs')
    .insert({ is_test: isTest, trigger: opts.trigger, run_date: today, mode: mock ? 'mock_preview' : 'real', keywords: keywords.map((k) => k.keyword), created_by_name: opts.actor?.name ?? 'Growth cron' })
    .select('id')
    .single();
  if (error) {
    if (error.code === '23505') return skip(`The morning run for ${today} has already happened.`);
    return { ok: false, status: 500, error: error.message };
  }
  const runId = (run as { id: string }).id;
  const finish = async (patch: Record<string, unknown>) => growthDb().from('growth_feed_runs').update({ ...patch, finished_at: new Date().toISOString() }).eq('id', runId);

  const p = feedPrompt(keywords, today);
  const ai = await runAi({ agent: FEED_AGENT, purpose: 'signal_feed', system: p.system, messages: [{ role: 'user', content: p.user }], webSearch: { maxUses: Math.min(10, Math.max(3, keywords.length)) }, maxTokens: 6000, isTest });
  if (!ai.ok) {
    await finish({ status: 'refused', detail: { reason: ai.reason, message: ai.message } });
    return { ok: true, value: { runId, mode: mock ? 'mock_preview' : 'real', previewOnly, status: 'refused', message: ai.message, decisions: [], saved: 0 } };
  }

  const { valid, discarded } = screenCandidates(extractJsonObject(ai.text), { sourceUrls: ai.sourceUrls, mock: ai.mock, today });
  const { unique, repeats } = dedupeWithinRun(assignKeywords(valid, keywords));
  const decisions: FeedDecision[] = [...discarded, ...repeats];
  const noSave = ai.mock || paused;
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

  await finish({ status: 'completed', found: valid.length + discarded.length, saved, duplicates, discarded: discarded.length, usage_id: ai.usageId, detail: { decisions: decisions.slice(0, 100), mock: ai.mock, preview_only: noSave, paused, keyword_source: keywordSource } });
  await logActivity({
    actorType: 'ai',
    actorId: FEED_AGENT,
    action: 'feed.run',
    summary: `${ai.mock ? 'Mock preview of the signal feed' : paused ? 'Preview of the paused signal feed' : 'Signal feed'}: ${saved} kept, ${duplicates} duplicates skipped, ${discarded.length} discarded without evidence or date`,
    isTest,
    metadata: { run_id: runId, trigger: opts.trigger, mock: ai.mock, preview_only: noSave },
  });
  const message = ai.mock
    ? 'Mock preview: nothing was saved. With an Anthropic key the same run adds real signals.'
    : paused
      ? 'Preview: the feed is paused, so nothing was saved. Switch it on in Settings to add signals.'
      : `${saved} signals added to the inbox.`;
  return { ok: true, value: { runId, mode: ai.mock ? 'mock_preview' : 'real', previewOnly: noSave, status: 'completed', message, decisions, saved } };
}

export type FeedRunRow = { id: string; created_at: string; trigger: string; run_date: string; mode: string; status: string; found: number; saved: number; duplicates: number; discarded: number; is_test: boolean; detail: Record<string, unknown> };

export async function recentFeedRuns(limit = 5): Promise<FeedRunRow[]> {
  const { data } = await growthDb().from('growth_feed_runs').select('*').order('created_at', { ascending: false }).limit(limit);
  return (data ?? []) as FeedRunRow[];
}
