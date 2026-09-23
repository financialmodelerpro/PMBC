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

type DupCandidate = Pick<GrowthSignal, 'id' | 'created_at' | 'company_id' | 'company_name' | 'trigger_type' | 'signal_date'> & { evidence_key?: string | null };

/**
 * The earlier signal this one duplicates, or null. Same evidence link wins;
 * otherwise the same company (by id, or by name when neither has an id) with
 * the same trigger type within the window.
 */
export function findDuplicate(
  signal: { id?: string; company_id: string | null; company_name: string | null; trigger_type: TriggerType; signal_date: string; evidence_url: string },
  existing: DupCandidate[],
): { id: string; why: 'same_evidence' | 'same_company_trigger' } | null {
  const key = evidenceKey(signal.evidence_url);
  const others = existing.filter((e) => e.id !== signal.id).sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  if (key) {
    const same = others.find((e) => e.evidence_key === key);
    if (same) return { id: same.id, why: 'same_evidence' };
  }
  const nameKey = companyNameKey(signal.company_name);
  const day = Date.parse(signal.signal_date);
  for (const e of others) {
    const sameCompany = signal.company_id && e.company_id ? signal.company_id === e.company_id : Boolean(nameKey) && companyNameKey(e.company_name) === nameKey;
    if (!sameCompany || e.trigger_type !== signal.trigger_type) continue;
    if (Math.abs(Date.parse(e.signal_date) - day) <= DUPLICATE_WINDOW_DAYS * 86_400_000) return { id: e.id, why: 'same_company_trigger' };
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
  z.object({ action: z.literal('not_duplicate') }),
]);

export type SignalTriage = z.infer<typeof signalTriageSchema>;

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
