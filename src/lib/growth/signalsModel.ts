/**
 * Signal Inbox rules (Unit 2.1, 2026-09-23). Pure: shared by the API, the
 * daily feed, the pilot import and the verifier.
 *
 * A signal is a dated trigger event with a real evidence link. Duplicates are
 * flagged, never blocked: the same evidence link, or the same company with the
 * same trigger type within DUPLICATE_WINDOW_DAYS, points at the earlier signal.
 */

import { z } from 'zod';

import { TRIGGER_TYPES, type GrowthSignal, type TriggerType } from './model';

export const DUPLICATE_WINDOW_DAYS = 14;
export const SIGNAL_LIMITS = { summary: 1000, sourceName: 120, reason: 500, companyName: 200 } as const;

export const SIGNAL_ORIGINS = [
  { value: 'manual', label: 'Added by hand' },
  { value: 'feed', label: 'Daily feed' },
  { value: 'import', label: 'Pilot import' },
] as const;
export type SignalOrigin = (typeof SIGNAL_ORIGINS)[number]['value'];

/** Hosts that can never be real evidence: reserved and local names. */
const NOT_REAL_HOST = /(^|\.)(example\.(com|net|org|invalid)|invalid|test|localhost|local)$/i;

/**
 * A link a person could open to see the evidence: http or https, a host with a
 * dot, not a reserved or local name. Mock output uses example.invalid, so it
 * can never pass.
 */
export function isRealEvidenceUrl(input: string | null | undefined): boolean {
  if (!input) return false;
  let u: URL;
  try {
    u = new URL(input.trim());
  } catch {
    return false;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
  if (!u.hostname.includes('.') || NOT_REAL_HOST.test(u.hostname)) return false;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(u.hostname)) return false;
  return true;
}

/**
 * The evidence link as a duplicate key: lower-case host without www, the path
 * without a trailing slash, tracking parameters and the fragment dropped.
 * Null when it is not a usable link.
 */
export function evidenceKey(input: string | null | undefined): string | null {
  if (!input) return null;
  let u: URL;
  try {
    u = new URL(input.trim());
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase().replace(/^www\./, '');
  const params = [...u.searchParams.entries()].filter(([k]) => !/^(utm_|fbclid|gclid|mc_|ref$|source$)/i.test(k)).sort(([a], [b]) => a.localeCompare(b));
  const query = params.length ? `?${params.map(([k, v]) => `${k}=${v}`).join('&')}` : '';
  const path = u.pathname.replace(/\/+$/, '') || '';
  return `${host}${path}${query}`;
}

/** A company name for matching: lower case, no punctuation, no legal suffixes. */
export function companyNameKey(input: string | null | undefined): string {
  return (input ?? '')
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/[^a-z0-9؀-ۿ ]+/g, ' ')
    .replace(/\b(co|company|ltd|limited|llc|llp|plc|inc|corp|corporation|group|holding|holdings|est|establishment|the|jsc|cjsc)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/*
 * Matching on the event, not the wording (2026-11-02). Before this, two
 * different events that cited the same site homepage were treated as one
 * (Mnzil and DataVolt were both dropped as "found twice"), while one event
 * worded twice slipped through (Arada as a market entry and as a new project;
 * "Hassan Allam Construction" and "Hassan Allam, Sterling & Wilson JV").
 */

/** Words that name a deal structure or a trade, not the company: left out when names are compared. */
const PARTY_FILLER = new Set(['construction', 'contracting', 'trading', 'consortium', 'jv', 'joint', 'venture', 'led', 'partnership']);
/** Where a name divides into parties: slashes, commas, en and em dashes (built from char codes so no dash sits in the source), " - ", " & ", "and", "with". */
const PARTY_SPLIT = new RegExp(`[/,;|+${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]|\\s-\\s|\\s&\\s|\\band\\b|\\bwith\\b`, 'i');
/** Words too common to identify a company on their own. */
const PARTY_COMMON = new Set(['saudi', 'arabia', 'arabian', 'national', 'gulf', 'al', 'arab', 'international', 'global', 'united', 'first', 'new', 'emirates', 'qatar', 'dubai', 'abu', 'dhabi', 'kingdom', 'middle', 'east', 'development', 'developments', 'investment', 'investments', 'real', 'estate', 'energy', 'power', 'capital', 'king', 'royal']);

/**
 * The companies a name refers to, each as a list of words: "Elsewedy Electric /
 * Sinohydro (JV)" is two parties, "ACWA Power-led consortium" one.
 */
export function companyParties(input: string | null | undefined): string[][] {
  return (input ?? '')
    .replace(/\(.*?\)/g, ' ')
    .split(PARTY_SPLIT)
    .map((p) => companyNameKey(p).split(' ').filter((w) => w && !PARTY_FILLER.has(w)))
    .filter((p) => p.length > 0);
}

/** Two parties are one company when their words match, or one name starts the other and is distinctive enough to stand alone. */
function sameParty(a: string[], b: string[]): boolean {
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (!short.every((w, i) => long[i] === w)) return false;
  if (short.length === long.length) return true;
  if (short.length >= 2) return true;
  return short[0].length >= 4 && !PARTY_COMMON.has(short[0]);
}

/** Whether two company names refer to the same company: any party in one matches a party in the other. */
export function sameCompanyName(a: string | null | undefined, b: string | null | undefined): boolean {
  const pa = companyParties(a);
  const pb = companyParties(b);
  return pa.some((x) => pb.some((y) => sameParty(x, y)));
}

/**
 * Triggers that describe the same kind of news. The feed sets the trigger from
 * the keyword a story matched, so one project can arrive as a new project, an
 * expansion or a market entry; those count as one family.
 */
const TRIGGER_FAMILY: Record<TriggerType, string> = {
  new_project: 'project',
  off_plan_registration: 'project',
  expansion: 'project',
  market_entry: 'project',
  contract_award: 'project',
  fundraising_debt: 'capital',
  capital_market_activity: 'capital',
  acquisition_jv: 'deal',
  finance_leadership_hire: 'people',
  other: 'other',
};
export const triggerFamily = (t: TriggerType): string => TRIGGER_FAMILY[t] ?? 'other';

/**
 * A link that points at one article or filing, not a site's home or section
 * page. A homepage can carry many stories, so it never proves two signals are
 * the same event.
 */
export function isArticleLink(input: string | null | undefined): boolean {
  const key = evidenceKey(input);
  if (!key) return false;
  const path = key.replace(/^[^/?]+/, '').replace(/\?.*$/, '');
  const segments = path.split('/').filter((s) => s && !/^(en|ar|news|home|index(\.\w+)?|default(\.\w+)?)$/i.test(s));
  return segments.length > 0 || key.includes('?');
}

export type EventLike = { company_id?: string | null; company_name: string | null; trigger_type: TriggerType; signal_date: string; evidence_url: string };

/**
 * Why two signals describe the same event, or null. Always the same company
 * (by id when both have one, else by name, loosely); then the same article,
 * or a trigger of the same family within DUPLICATE_WINDOW_DAYS, or any trigger
 * on the same day. A shared homepage alone, or two companies in one article,
 * is never a match.
 */
export function sameEvent(a: EventLike, b: EventLike & { evidence_key?: string | null }): 'same_evidence' | 'same_company_trigger' | null {
  const company = a.company_id && b.company_id ? a.company_id === b.company_id : sameCompanyName(a.company_name, b.company_name);
  if (!company) return null;
  const keyA = evidenceKey(a.evidence_url);
  const keyB = b.evidence_key ?? evidenceKey(b.evidence_url);
  if (keyA && keyA === keyB && isArticleLink(a.evidence_url)) return 'same_evidence';
  const gap = Math.abs(Date.parse(a.signal_date) - Date.parse(b.signal_date));
  if (!Number.isFinite(gap)) return null;
  if (gap === 0) return 'same_company_trigger';
  if (triggerFamily(a.trigger_type) === triggerFamily(b.trigger_type) && gap <= DUPLICATE_WINDOW_DAYS * 86_400_000) return 'same_company_trigger';
  return null;
}

/** How good a signal's evidence and summary are, to keep the better of two versions of one event. Higher is better. */
export function signalQuality(s: { evidence_url: string; summary: string | null }): number {
  return (isArticleLink(s.evidence_url) ? 10_000 : 0) + Math.min((s.summary ?? '').trim().length, 1000);
}

type DupCandidate = Pick<GrowthSignal, 'id' | 'created_at' | 'company_id' | 'company_name' | 'trigger_type' | 'signal_date' | 'evidence_url'> & { evidence_key?: string | null };

/**
 * The earlier signal this one duplicates, or null: the oldest signal that
 * describes the same event (`sameEvent`). Flagged, never blocked.
 */
export function findDuplicate(
  signal: { id?: string; company_id: string | null; company_name: string | null; trigger_type: TriggerType; signal_date: string; evidence_url: string },
  existing: DupCandidate[],
): { id: string; why: 'same_evidence' | 'same_company_trigger' } | null {
  const others = existing.filter((e) => e.id !== signal.id).sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  for (const e of others) {
    const why = sameEvent(signal, e);
    if (why === 'same_evidence') return { id: e.id, why };
  }
  for (const e of others) {
    const why = sameEvent(signal, e);
    if (why) return { id: e.id, why };
  }
  return null;
}

const TRIGGER_VALUES = TRIGGER_TYPES.map((t) => t.value) as [TriggerType, ...TriggerType[]];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A signal date: a real calendar day, not more than a day in the future. */
export const signalDateSchema = z
  .string()
  .regex(DATE, 'Use YYYY-MM-DD')
  .refine((d) => !Number.isNaN(Date.parse(`${d}T00:00:00Z`)) && new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) === d, 'Not a real date')
  .refine((d) => Date.parse(`${d}T00:00:00Z`) <= Date.now() + 86_400_000, 'The date is in the future');

export const signalCreateSchema = z
  .object({
    trigger_type: z.enum(TRIGGER_VALUES),
    signal_date: signalDateSchema,
    summary: z.string().trim().min(10, 'Describe the signal in a sentence').max(SIGNAL_LIMITS.summary),
    evidence_url: z.string().trim().max(2000).refine(isRealEvidenceUrl, 'Give a real evidence link someone can open (http or https)'),
    company_id: z.string().uuid().nullable().optional(),
    company_name: z.string().trim().max(SIGNAL_LIMITS.companyName).nullable().optional(),
    source_name: z.string().trim().max(SIGNAL_LIMITS.sourceName).nullable().optional(),
  })
  .refine((s) => Boolean(s.company_id) || Boolean(s.company_name?.trim()), { message: 'Name the company or choose an existing one', path: ['company_name'] });

export type SignalCreateInput = z.infer<typeof signalCreateSchema>;

const newCompany = z.object({
  name: z.string().trim().min(1).max(SIGNAL_LIMITS.companyName),
  website_domain: z.string().trim().max(200).nullable().optional(),
  sector: z.string().trim().max(120).nullable().optional(),
  city: z.string().trim().max(120).nullable().optional(),
  country: z.string().trim().max(120).nullable().optional(),
});

export const signalTriageSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('convert'),
    /** Use an existing company, or create one. */
    company_id: z.string().uuid().nullable().optional(),
    company: newCompany.nullable().optional(),
    lead_title: z.string().trim().max(200).nullable().optional(),
  }),
  z.object({ action: z.literal('attach'), company_id: z.string().uuid(), lead_id: z.string().uuid().nullable().optional() }),
  z.object({ action: z.literal('dismiss'), reason: z.string().trim().min(3, 'Give a reason').max(SIGNAL_LIMITS.reason) }),
  z.object({ action: z.literal('reopen') }),
  /** A keyword match only suggests the trigger: Ahmad can change it. */
  z.object({ action: z.literal('retype'), trigger_type: z.enum(TRIGGER_VALUES) }),
  z.object({ action: z.literal('not_duplicate') }),
]);

export type SignalTriage = z.infer<typeof signalTriageSchema>;

/** Most signals one bulk dismissal may touch. */
export const BULK_DISMISS_MAX = 200;

/**
 * Dismiss several signals at once (2026-11-02): each with its own reason (the
 * inbox cleanup) or one reason for all (ticked in the list). Only signals
 * still new are dismissed.
 */
export const signalBulkDismissSchema = z.object({
  items: z
    .array(z.object({ id: z.string().uuid(), reason: z.string().trim().min(3, 'Give a reason').max(SIGNAL_LIMITS.reason) }))
    .min(1, 'Tick at least one signal')
    .max(BULK_DISMISS_MAX, `At most ${BULK_DISMISS_MAX} at a time`)
    .refine((items) => new Set(items.map((i) => i.id)).size === items.length, 'A signal is listed twice'),
});
export type SignalBulkDismiss = z.infer<typeof signalBulkDismissSchema>;

export const SIGNAL_FILTER_KEYS = ['status', 'trigger', 'origin', 'from', 'to', 'q', 'dup', 'test'] as const;
export type SignalFilters = { status: string; trigger: string; origin: string; from: string; to: string; q: string; dup: boolean; includeTest: boolean };

export function parseSignalFilters(search: Record<string, string | string[] | undefined>): SignalFilters {
  const one = (k: string) => (typeof search[k] === 'string' ? (search[k] as string) : '');
  const status = one('status');
  const trigger = one('trigger');
  const origin = one('origin');
  return {
    status: ['new', 'converted', 'attached', 'dismissed', 'all'].includes(status) ? status : 'new',
    trigger: TRIGGER_TYPES.some((t) => t.value === trigger) ? trigger : '',
    origin: SIGNAL_ORIGINS.some((o) => o.value === origin) ? origin : '',
    from: DATE.test(one('from')) ? one('from') : '',
    to: DATE.test(one('to')) ? one('to') : '',
    q: one('q').trim().slice(0, 100),
    dup: one('dup') === '1',
    includeTest: one('test') === '1',
  };
}
