/**
 * The daily signal feed's pure rules (2026-10-29): how the answer is read,
 * what each reading is called, the cost estimate and the group order. Pure:
 * the verifiers and the Settings form use it directly.
 *
 * Why this exists: on 2026-10-29 a real run spent USD 0.42, wrote about 4,900
 * tokens and saved nothing, because the answer was asked for as bare JSON
 * while web search makes the model narrate, and an unreadable answer was
 * counted exactly like an empty one. Now the model returns its findings
 * through a tool (`report_signals`) whose input the API checks against a
 * schema, text is only a fallback read robustly, and every call records which
 * of five outcomes it had.
 */

import { TRIGGER_TYPES } from './model';

/** How the model judges a candidate's company as a buyer of the firm's advice (2026-10-29). */
export const PROSPECT_FITS = ['prospect', 'unlikely_buyer', 'not_a_prospect'] as const;
export type ProspectFit = (typeof PROSPECT_FITS)[number];

/** The sector tiers the Prospect Score credits (Settings, Sector tiers), as the model names a company's own business. */
export const FEED_SECTOR_TIERS = ['real_estate', 'infrastructure', 'investment', 'services', 'other'] as const;
export type FeedSectorTier = (typeof FEED_SECTOR_TIERS)[number];

export const FEED_RESULT_TOOL = 'report_signals';

/** The tool the model calls once with its findings. Strict: the API checks the input against this schema. */
export function feedResultTool(): { name: string; description: string; inputSchema: Record<string, unknown> } {
  return {
    name: FEED_RESULT_TOOL,
    description:
      'Report the trigger events you found, once, after you finish searching. Call it with an empty signals list when nothing qualifies. Every evidence_url must be a URL your searches returned.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['signals'],
      properties: {
        signals: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['company_name', 'trigger_type', 'signal_date', 'summary', 'evidence_url', 'source_name', 'keyword_number', 'location', 'company_sector', 'sector_tier', 'size_sar', 'prospect_fit', 'fit_reason'],
            properties: {
              company_name: { type: 'string' },
              trigger_type: { type: 'string', enum: TRIGGER_TYPES.map((t) => t.value) },
              signal_date: { type: 'string', description: 'Publication date of the source, YYYY-MM-DD' },
              summary: { type: 'string', description: 'One or two plain sentences stating what the source says' },
              evidence_url: { type: 'string', description: 'The exact URL of the article or filing, as returned by your search' },
              source_name: { type: 'string' },
              keyword_number: { type: 'integer', description: 'The number of the keyword this event best matches' },
              location: { type: 'string', description: 'Country and city of the company or project as the source says, e.g. "Riyadh, Saudi Arabia"; empty when not stated' },
              company_sector: { type: 'string', description: 'The named company\'s sector in a few words, e.g. "real estate developer", "logistics fund", "EPC contractor"' },
              sector_tier: {
                type: 'string',
                enum: [...FEED_SECTOR_TIERS],
                description: "The named company's own business, never the project's location or a headline word: real_estate (residential, commercial or hospitality developers and owners, master and giga-project developers), infrastructure (energy and power, utilities, water, rail and transport, construction and EPC, industrial, logistics operators), investment (funds, asset managers, private equity, family offices, holding companies), services (healthcare, education, retail, technology, banks and other services), other",
              },
              size_sar: { type: 'number', description: 'Project or deal size in SAR as the source states it (convert USD at 3.75); 0 when not stated' },
              prospect_fit: { type: 'string', enum: [...PROSPECT_FITS], description: 'prospect, unlikely_buyer or not_a_prospect, by the rules in the instructions' },
              fit_reason: { type: 'string', description: 'One short clause: why this fit' },
            },
          },
        },
      },
    },
  };
}

/** What reading one answer produced. `candidates` carries how many. */
export type ParseOutcomeKind = 'no_json' | 'invalid_json' | 'no_signals_key' | 'empty_list' | 'candidates';
export type ParseOutcome = { kind: ParseOutcomeKind; count: number; source: 'tool' | 'text' | 'none' };

export const PARSE_LABELS: Record<ParseOutcomeKind, string> = {
  no_json: 'no JSON in the answer',
  invalid_json: 'JSON that could not be read',
  no_signals_key: 'JSON without a signals list',
  empty_list: 'nothing found',
  candidates: 'candidates found',
};

const hasSignals = (v: unknown): v is { signals: unknown[] } => Boolean(v) && typeof v === 'object' && Array.isArray((v as { signals?: unknown }).signals);

/** Every balanced top-level `{...}` in a text, in order. Quotes are tracked only inside an object, so prose apostrophes and quotes do no harm. */
export function jsonObjectSpans(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (depth > 0 && inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (depth > 0 && ch === '"') inString = true;
    else if (depth > 0 && ch === '}') {
      depth--;
      if (depth === 0) out.push(text.slice(start, i + 1));
    }
  }
  return out;
}

/**
 * Reads the feed's answer. The tool input wins; text is the fallback, read
 * past code fences, narration and other objects, taking the first object that
 * carries a signals list rather than the first object found.
 */
export function readFeedAnswer(answer: { toolInput?: unknown; text: string }): { value: { signals: unknown[] } | null; outcome: ParseOutcome } {
  const of = (v: { signals: unknown[] }, source: 'tool' | 'text') => ({ value: v, outcome: { kind: v.signals.length ? 'candidates' : 'empty_list', count: v.signals.length, source } as ParseOutcome });
  if (answer.toolInput !== undefined && answer.toolInput !== null) {
    if (hasSignals(answer.toolInput)) return of(answer.toolInput, 'tool');
    return { value: null, outcome: { kind: 'no_signals_key', count: 0, source: 'tool' } };
  }
  const spans = jsonObjectSpans(answer.text.replace(/```[a-zA-Z]*\s*/g, ''));
  if (!spans.length) return { value: null, outcome: { kind: 'no_json', count: 0, source: answer.text.trim() ? 'text' : 'none' } };
  let parsedAny = false;
  for (const span of spans) {
    let v: unknown;
    try {
      v = JSON.parse(span);
    } catch {
      continue;
    }
    parsedAny = true;
    if (hasSignals(v)) return of(v, 'text');
  }
  return { value: null, outcome: { kind: parsedAny ? 'no_signals_key' : 'invalid_json', count: 0, source: 'text' } };
}

/** One line for the Signals screen: how many answers were read and what they said, so "nothing found" never reads like "could not read". */
export function summarizeOutcomes(outcomes: ParseOutcome[]): string {
  if (!outcomes.length) return 'no answers to read';
  const by = (k: ParseOutcomeKind) => outcomes.filter((o) => o.kind === k);
  const parts: string[] = [];
  const found = by('candidates');
  if (found.length) parts.push(`${found.reduce((a, o) => a + o.count, 0)} candidates from ${found.length} ${found.length === 1 ? 'group' : 'groups'}`);
  if (by('empty_list').length) parts.push(`${by('empty_list').length} found nothing`);
  const unread = outcomes.filter((o) => o.kind === 'no_json' || o.kind === 'invalid_json' || o.kind === 'no_signals_key');
  if (unread.length) {
    const kinds = [...new Set(unread.map((o) => PARSE_LABELS[o.kind]))].join(', ');
    parts.push(`${unread.length} could not be read (${kinds})`);
  }
  return `${outcomes.length} ${outcomes.length === 1 ? 'answer' : 'answers'} read: ${parts.join('; ')}`;
}

/**
 * Cost of one group's call, estimated before it runs: USD 0.05 a search. The
 * 2026-10-29 run measured USD 0.042 a search (10 searches, 133,339 input and
 * 4,910 output tokens on Claude Sonnet 5, USD 0.42), so this leans high.
 */
export const FEED_ESTIMATE_USD_PER_SEARCH = 0.05;
export function estimateGroupCostUsd(searches: number): number {
  return Math.round(searches * FEED_ESTIMATE_USD_PER_SEARCH * 100) / 100;
}

/**
 * Every active group is searched at once (2026-10-29: running them in rounds
 * of five let the 170 second limit drop the second round, real estate
 * included). The cost ceiling is the constraint, not time. Up to this many
 * calls start together; the library has eleven groups.
 */
export const FEED_CONCURRENCY = 12;
/**
 * The run's deadline, from its start. The function may run 300 seconds; this
 * leaves time to save. A call never starts a new request (a resume, or the
 * reminder to report) after the deadline, and a request is cut at it.
 */
export const FEED_RUN_BUDGET_MS = 250_000;
/** One request inside a call gives up after this long, or at the run deadline if sooner. */
export const FEED_CALL_TIMEOUT_MS = 240_000;
/** Kept for the Settings text: groups are no longer run in rounds. */
export const FEED_TIME_BUDGET_MS = FEED_RUN_BUDGET_MS;

/** Why a group was not fully searched in a run; it is searched first next time. */
export type CarryReason = 'cost_ceiling' | 'time_limit' | 'failed';

/**
 * The order groups are searched in: any the last run could not search first
 * (in that run's order), then the rest rotated by the day of the year.
 */
export function orderGroups<T extends { key: string }>(groups: T[], carriedOver: string[], today: string): T[] {
  const first = carriedOver.map((k) => groups.find((g) => g.key === k)).filter((g): g is T => Boolean(g));
  const rest = rotateGroups(groups.filter((g) => !carriedOver.includes(g.key)), today);
  return [...first, ...rest];
}

/**
 * The order groups run in: rotated by the day of the year, so a group left
 * out by the cost ceiling or the time limit one day runs early on another.
 */
export function rotateGroups<T>(groups: T[], today: string): T[] {
  if (groups.length < 2) return groups;
  const d = Date.parse(`${today}T00:00:00Z`);
  const day = Number.isFinite(d) ? Math.floor((d - Date.UTC(new Date(d).getUTCFullYear(), 0, 1)) / 86_400_000) : 0;
  const k = day % groups.length;
  return [...groups.slice(k), ...groups.slice(0, k)];
}

/*
 * Holding the ceiling (2026-11-02). The 2026-10-29 run cost USD 3.22 against
 * USD 3.00: every group was reserved at the average call (about USD 0.25),
 * but all nine run at once and calls ranged from USD 0.16 to 0.55. A call
 * cannot be stopped once it has started, so the reservation must be the worst
 * case, and the number of searches is what brings nine worst cases under the
 * ceiling.
 */

/** One past call: what it cost and how many searches it made. */
export type CallCost = { cost: number; searches: number };
/** The dearest call measured before this rule (2026-10-29: USD 0.55 for 5 searches), used until there is history. */
export const FEED_WORST_CALL: CallCost = { cost: 0.55, searches: 5 };
/** Fewer searches than this leaves a group barely searched: below it, groups are left out and carried over instead. */
export const FEED_MIN_SEARCHES = 2;

const ceil2 = (n: number) => Math.ceil(n * 100 - 1e-9) / 100;

/**
 * The most a call with `searches` searches is expected to cost: the dearest
 * recent call per search, scaled to this many searches. A call's cost grows
 * faster than its searches (each search reads the results of the ones before
 * it), so the rate per search is scaled by (searches + 1) / (its searches + 1).
 */
export function worstCallUsd(recent: CallCost[], searches: number): number {
  const known = recent.filter((c) => Number.isFinite(c.cost) && c.cost > 0 && c.searches > 0);
  const basis = known.length ? known : [FEED_WORST_CALL];
  const rate = Math.max(...basis.map((c) => (c.cost / c.searches) * ((searches + 1) / (c.searches + 1))));
  return ceil2(rate * searches);
}

/**
 * The searches each group gets this run: the setting, lowered until every
 * group's worst case fits the ceiling together, but not below
 * FEED_MIN_SEARCHES. `fits` is false when even that does not fit every group;
 * the start check then leaves the rest out, to be searched first next run.
 */
export function fitSearches(opts: { groups: number; ceilingUsd: number; maxSearches: number; recent: CallCost[] }): { searches: number; reserveUsd: number; fits: boolean } {
  const top = Math.max(1, Math.floor(opts.maxSearches));
  const floor = Math.min(FEED_MIN_SEARCHES, top);
  for (let s = top; s >= floor; s--) {
    const reserve = worstCallUsd(opts.recent, s);
    if (Math.round(reserve * opts.groups * 100) / 100 <= opts.ceilingUsd) return { searches: s, reserveUsd: reserve, fits: true };
  }
  return { searches: floor, reserveUsd: worstCallUsd(opts.recent, floor), fits: false };
}

/** Whether the next call may start: spend so far plus the calls already started plus this one stays within the ceiling. */
export function withinCeiling(spentUsd: number, committedUsd: number, nextUsd: number, ceilingUsd: number): boolean {
  return Math.round((spentUsd + committedUsd + nextUsd) * 100) / 100 <= ceilingUsd;
}

/** The oldest date the window allows, YYYY-MM-DD. */
export function oldestAllowed(today: string, windowDays: number): string {
  return new Date(Date.parse(`${today}T00:00:00Z`) - windowDays * 86_400_000).toISOString().slice(0, 10);
}

/* Cadence and the monthly projection (2026-10-29, migration 114). */

/** The Riyadh weekday, 0 Sunday to 6 Saturday. Riyadh keeps UTC+3 all year. */
export function riyadhWeekday(now: Date = new Date()): number {
  return new Date(now.getTime() + 3 * 3_600_000).getUTCDay();
}

/** Whether the morning job runs the feed today. A run by hand ignores this. */
export function isFeedDay(days: number[], now: Date = new Date()): boolean {
  return days.includes(riyadhWeekday(now));
}

/** Each weekday falls about 52 / 12 times a month. */
export const WEEKS_PER_MONTH = 52 / 12;

/** Expected feed spend in a month: cost per run times the ticked days times weeks a month. */
export function projectMonthlyUsd(perRunUsd: number, days: number[]): number {
  return Math.round(perRunUsd * days.length * WEEKS_PER_MONTH * 100) / 100;
}

/** True when the projection takes more than half the monthly AI budget. No budget set: no warning (nothing runs without one). */
export function overHalfBudget(projectedUsd: number, budgetUsd: number | null): boolean {
  return budgetUsd !== null && budgetUsd > 0 && projectedUsd > budgetUsd / 2;
}

/** Whether a run expected to cost `runUsd` fits what is left of the month's budget. */
export function budgetAllowsRun(spentUsd: number, runUsd: number, budgetUsd: number | null): boolean {
  if (budgetUsd === null || !(budgetUsd > 0)) return false;
  return Math.round((spentUsd + runUsd) * 100) / 100 <= budgetUsd;
}

/**
 * The cost a run is expected to have: the average of recent completed real
 * runs, measured; or, before any, the per-search estimate for every group.
 */
export type FeedCostBasis = { perRunUsd: number; basis: 'measured' | 'estimate'; runs: number };
export function costBasis(recentRunCosts: number[], groups: number, searchesPerGroup: number): FeedCostBasis {
  const measured = recentRunCosts.filter((c) => Number.isFinite(c) && c > 0);
  if (measured.length) return { perRunUsd: Math.round((measured.reduce((a, b) => a + b, 0) / measured.length) * 100) / 100, basis: 'measured', runs: measured.length };
  return { perRunUsd: Math.round(estimateGroupCostUsd(searchesPerGroup) * groups * 100) / 100, basis: 'estimate', runs: 0 };
}

/** Why the morning job skips today, or null when it runs. A run by hand never skips for the day. */
export function morningDaySkip(trigger: 'cron' | 'manual', days: number[], now: Date = new Date()): string | null {
  if (trigger !== 'cron' || isFeedDay(days, now)) return null;
  return 'Not a feed day: the morning run happens only on the days ticked in Settings. A run by hand works any day.';
}
