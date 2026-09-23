/**
 * The daily signal feed (Unit 2.6, 2026-09-23). Server only.
 *
 * Each morning (Riyadh time) the Growth cron asks the signal-feed agent to
 * search for new trigger events matching the keywords Ahmad manages in
 * Settings. A signal is kept only with a real evidence link that the search
 * actually returned; one without is discarded. Duplicates of signals already
 * in the inbox are skipped. At most `signal_feed_max_per_run` are kept. The AI
 * budget applies through runAi, like every call.
 *
 * Scheduled runs happen once a Riyadh day (a unique key on the run date), can
 * be paused in Settings, and do not run at all in mock mode. A manual run is
 * always allowed; in mock mode it is a labelled preview and saves no signals.
 */

import { logActivity } from './activity';
import { isMockMode } from './ai/provider';
import { runAi } from './ai/run';
import type { WriteResult } from './api';
import { growthDb, tableExists } from './db';
import { getEngineSettings, pendingMigration } from './engineSettings';
import { riyadhDate } from './format';
import type { Actor } from './kb';
import { TRIGGER_TYPES, type TriggerType } from './model';
import { createSignal, existingDuplicate } from './signals';
import { isRealEvidenceUrl } from './signalsModel';
import { extractJsonObject } from './agents/json';

export const FEED_AGENT = 'signal-feed';
/** Signals older than this are not news and are discarded. */
export const FEED_MAX_AGE_DAYS = 30;

export type FeedCandidate = { company_name: string; trigger_type: TriggerType; signal_date: string; summary: string; evidence_url: string; source_name: string | null };
export type FeedDecision = FeedCandidate & { outcome: 'kept' | 'duplicate' | 'discarded' | 'over_limit'; why: string };

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
    const c: FeedCandidate = {
      company_name: String(s.company_name ?? '').trim().slice(0, 200),
      trigger_type: (triggers.includes(String(s.trigger_type)) ? s.trigger_type : 'other') as TriggerType,
      signal_date: String(s.signal_date ?? '').slice(0, 10),
      summary: String(s.summary ?? '').trim().slice(0, 1000),
      evidence_url: String(s.evidence_url ?? '').trim(),
      source_name: s.source_name ? String(s.source_name).trim().slice(0, 120) : null,
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

function prompt(keywords: string[], today: string): { system: string; user: string } {
  return {
    system: [
      'You find trigger events that suggest a company in Saudi Arabia or the wider GCC may need corporate finance or transaction advisory: new projects, off-plan registrations, fundraising or debt, market entry, finance leadership hires, contract awards, acquisitions or joint ventures, capital market activity, and expansions.',
      'Use web search. Report only events published in the last 7 days that match at least one of the keywords.',
      'Every event must have an evidence_url: the exact URL of the article or filing you read, as returned by your search. Never construct, shorten or guess a URL. If you cannot give one, leave the event out.',
      'Never invent companies, people, amounts or dates. Summaries are one or two plain sentences stating what the source says.',
      `Trigger types: ${TRIGGER_TYPES.map((t) => t.value).join(', ')}.`,
      'Answer with one JSON object and nothing else: {"signals":[{"company_name":string,"trigger_type":string,"signal_date":"YYYY-MM-DD","summary":string,"evidence_url":string,"source_name":string}]}',
    ].join('\n'),
    user: `Today is ${today} (Riyadh). Keywords:\n${keywords.map((k) => `- ${k}`).join('\n')}`,
  };
}

export type FeedRunResult = {
  runId: string | null;
  mode: 'real' | 'mock_preview';
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
  const { signal_keywords: keywords, signal_feed_paused: paused, signal_feed_max_per_run: max } = engine.values;
  const skip = (message: string): WriteResult<FeedRunResult> => ({ ok: true, value: { runId: null, mode: mock ? 'mock_preview' : 'real', status: 'skipped', message, decisions: [], saved: 0 } });
  if (opts.trigger === 'cron' && paused) return skip('The morning run is paused in Settings.');
  if (opts.trigger === 'cron' && mock) return skip('Mock mode: the morning run only happens with an Anthropic key. Run it by hand for a labelled preview.');
  if (!keywords.length) return skip('No keywords are set. Add them in Growth Settings.');

  const { data: run, error } = await growthDb()
    .from('growth_feed_runs')
    .insert({ is_test: isTest, trigger: opts.trigger, run_date: today, mode: mock ? 'mock_preview' : 'real', keywords, created_by_name: opts.actor?.name ?? 'Growth cron' })
    .select('id')
    .single();
  if (error) {
    if (error.code === '23505') return skip(`The morning run for ${today} has already happened.`);
    return { ok: false, status: 500, error: error.message };
  }
  const runId = (run as { id: string }).id;
  const finish = async (patch: Record<string, unknown>) => growthDb().from('growth_feed_runs').update({ ...patch, finished_at: new Date().toISOString() }).eq('id', runId);

  const p = prompt(keywords, today);
  const ai = await runAi({ agent: FEED_AGENT, purpose: 'signal_feed', system: p.system, messages: [{ role: 'user', content: p.user }], webSearch: { maxUses: Math.min(10, Math.max(3, keywords.length)) }, maxTokens: 6000, isTest });
  if (!ai.ok) {
    await finish({ status: 'refused', detail: { reason: ai.reason, message: ai.message } });
    return { ok: true, value: { runId, mode: mock ? 'mock_preview' : 'real', status: 'refused', message: ai.message, decisions: [], saved: 0 } };
  }

  const { valid, discarded } = screenCandidates(extractJsonObject(ai.text), { sourceUrls: ai.sourceUrls, mock: ai.mock, today });
  const decisions: FeedDecision[] = [...discarded];
  let saved = 0;
  let duplicates = 0;
  for (const c of valid) {
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
    if (ai.mock) {
      // Mock mode previews only: nothing is saved as a real signal.
      decisions.push({ ...c, outcome: 'kept', why: 'would be kept (preview only)' });
      continue;
    }
    const r = await createSignal({ ...c, company_id: null }, null, { origin: 'feed', feedRunId: runId, isTest, actorType: 'ai', actorId: FEED_AGENT });
    if (r.ok) {
      saved++;
      decisions.push({ ...c, outcome: 'kept', why: 'added to the inbox' });
    } else decisions.push({ ...c, outcome: 'discarded', why: r.error });
  }

  await finish({ status: 'completed', found: valid.length + discarded.length, saved, duplicates, discarded: discarded.length, usage_id: ai.usageId, detail: { decisions: decisions.slice(0, 100), mock: ai.mock } });
  await logActivity({
    actorType: 'ai',
    actorId: FEED_AGENT,
    action: 'feed.run',
    summary: `${ai.mock ? 'Mock preview of the signal feed' : 'Signal feed'}: ${saved} kept, ${duplicates} duplicates skipped, ${discarded.length} discarded without evidence or date`,
    isTest,
    metadata: { run_id: runId, trigger: opts.trigger, mock: ai.mock },
  });
  const message = ai.mock ? 'Mock preview: nothing was saved. With an Anthropic key the same run adds real signals.' : `${saved} signals added to the inbox.`;
  return { ok: true, value: { runId, mode: ai.mock ? 'mock_preview' : 'real', status: 'completed', message, decisions, saved } };
}

export type FeedRunRow = { id: string; created_at: string; trigger: string; run_date: string; mode: string; status: string; found: number; saved: number; duplicates: number; discarded: number; is_test: boolean; detail: Record<string, unknown> };

export async function recentFeedRuns(limit = 5): Promise<FeedRunRow[]> {
  const { data } = await growthDb().from('growth_feed_runs').select('*').order('created_at', { ascending: false }).limit(limit);
  return (data ?? []) as FeedRunRow[];
}
