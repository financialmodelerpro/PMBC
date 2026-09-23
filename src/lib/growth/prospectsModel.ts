/**
 * Prospects: companies, their contacts and leads (Unit 2.2, 2026-09-23).
 * Pure: request schemas, list filters and row shapes added by migration 088.
 */

import { z } from 'zod';

import {
  COMPANY_STATUSES,
  CONSENT_STATUSES,
  LEAD_SOURCES,
  PIPELINE_STAGES,
  PROSPECT_BANDS,
  isGrowthService,
  type GrowthCompany,
  type LeadSource,
  type ProspectBand,
} from './model';

/** The company row with the columns migration 088 adds. They are absent until it is applied. */
export type ProspectCompany = GrowthCompany & {
  source?: LeadSource | null;
  scale_sar?: number | string | null;
  computed_score?: number | null;
  prospect_score?: number | null;
  prospect_band?: ProspectBand | null;
  score_reasons?: string[];
  score_override?: boolean;
  override_reason?: string | null;
  scored_at?: string | null;
  import_id?: string | null;
};

export const PROSPECT_LIMITS = { name: 200, text: 200, long: 4000, url: 500 } as const;

const optText = (max: number = PROSPECT_LIMITS.text) => z.string().trim().max(max).nullable().optional();
const service = z.string().refine(isGrowthService, 'Not one of the site services').nullable().optional();
const money = z.number().min(0).max(1_000_000_000_000).nullable().optional();
const url = z
  .string()
  .trim()
  .max(PROSPECT_LIMITS.url)
  .refine((u) => u === '' || /^https?:\/\/\S+$/i.test(u), 'Use a full link starting with https://')
  .nullable()
  .optional();

const enumOf = <T extends readonly { value: string }[]>(list: T) => z.enum(list.map((x) => x.value) as [T[number]['value'], ...T[number]['value'][]]);

export const companyFields = {
  name: z.string().trim().min(1, 'Give the company a name').max(PROSPECT_LIMITS.name),
  website_domain: optText(),
  sector: optText(120),
  city: optText(120),
  country: optText(120),
  description: optText(PROSPECT_LIMITS.long),
  linkedin_url: url,
  likely_service: service,
  status: enumOf(COMPANY_STATUSES).optional(),
  notes: optText(PROSPECT_LIMITS.long),
  source: enumOf(LEAD_SOURCES).nullable().optional(),
  scale_sar: money,
};

export const companyCreateSchema = z.object(companyFields);
export const companyUpdateSchema = z.object(companyFields).partial();

export const contactFields = {
  full_name: z.string().trim().min(1, 'Give the contact a name').max(PROSPECT_LIMITS.name),
  role_title: optText(),
  email: z.string().trim().toLowerCase().max(320).refine((e) => e === '' || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e), 'Enter a valid email address').nullable().optional(),
  phone: optText(40),
  linkedin_url: url,
  is_decision_maker: z.boolean().optional(),
  consent_status: enumOf(CONSENT_STATUSES).optional(),
  consent_source: optText(),
  notes: optText(PROSPECT_LIMITS.long),
};

export const contactCreateSchema = z.object(contactFields);
export const contactUpdateSchema = z.object(contactFields).partial();

export const leadFields = {
  title: z.string().trim().min(1, 'Give the lead a title').max(PROSPECT_LIMITS.name),
  contact_id: z.string().uuid().nullable().optional(),
  stage: enumOf(PIPELINE_STAGES).optional(),
  recommended_service: service,
  requirement: optText(PROSPECT_LIMITS.long),
  deal_size_sar: money,
  timeline: optText(),
  source: enumOf(LEAD_SOURCES).optional(),
  source_ref: optText(),
  next_action: optText(500),
  next_action_due: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  lost_reason: optText(500),
  /** Migration 089. */
  meeting_requested: z.boolean().optional(),
};

export const leadCreateSchema = z.object(leadFields);
export const leadUpdateSchema = z.object(leadFields).partial();

export const scoreOverrideSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('set'), score: z.number().int().min(0).max(100), reason: z.string().trim().min(5, 'Give a reason for the override').max(500) }),
  z.object({ action: z.literal('clear') }),
]);

export type ProspectFilters = { band: string; status: string; source: string; q: string; includeTest: boolean };

export function parseProspectFilters(search: Record<string, string | string[] | undefined>): ProspectFilters {
  const one = (k: string) => (typeof search[k] === 'string' ? (search[k] as string) : '');
  const band = one('band');
  const status = one('status');
  const source = one('source');
  return {
    band: PROSPECT_BANDS.some((b) => b.value === band) || band === 'unscored' ? band : '',
    status: COMPANY_STATUSES.some((s) => s.value === status) ? status : '',
    source: LEAD_SOURCES.some((s) => s.value === source) ? source : '',
    q: one('q').trim().slice(0, 100),
    includeTest: one('test') === '1',
  };
}

/** Empty strings from a form become null, so an optional field can be cleared. */
export function blankToNull<T extends Record<string, unknown>>(input: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) out[k] = typeof v === 'string' && v.trim() === '' ? null : v;
  return out as T;
}
