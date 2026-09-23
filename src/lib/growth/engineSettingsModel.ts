/**
 * Growth Engine settings added from Phase 2 onwards (2026-09-23): defaults,
 * limits and validation. Pure.
 *
 * These live as typed columns on the same `growth_settings` row as the Phase 1
 * settings, each added by the migration named below, so the database checks
 * every value again and the 087 trigger logs every change with old and new
 * values. They are read through `getEngineSettings` (engineSettings.ts), which
 * reports which columns are missing: a feature whose setting has no column yet
 * refuses to run rather than run on a default.
 */

import { z } from 'zod';

import { MODEL_PRICES } from './ai/pricing';

export const SCORING_FACTORS = [
  { key: 'geography', label: 'Geography', hint: 'KSA first, then the wider GCC' },
  { key: 'sector', label: 'Sector', hint: 'Real estate highest' },
  { key: 'project_signal', label: 'Project signal', hint: 'A new project, registration, award or expansion' },
  { key: 'funding_signal', label: 'Funding or transaction signal', hint: 'Fundraising, debt, acquisition, JV or capital markets' },
  { key: 'scale', label: 'Scale', hint: 'Known project or deal size; unknown scores zero' },
  { key: 'decision_maker', label: 'Decision-maker', hint: 'A named decision-maker on file' },
  { key: 'recency', label: 'Recency', hint: 'How fresh the latest signal is' },
] as const;
export type ScoringFactor = (typeof SCORING_FACTORS)[number]['key'];
export type ScoringWeights = Record<ScoringFactor, number>;

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  geography: 10,
  sector: 15,
  project_signal: 20,
  funding_signal: 20,
  scale: 15,
  decision_maker: 10,
  recency: 10,
};

export const LEAD_FACTORS = [
  { key: 'icp_fit', label: 'ICP fit' },
  { key: 'clear_need', label: 'Clear need' },
  { key: 'scale', label: 'Scale' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'authority', label: 'Authority' },
  { key: 'engagement', label: 'Engagement' },
  { key: 'meeting_intent', label: 'Meeting intent' },
] as const;
export type LeadFactor = (typeof LEAD_FACTORS)[number]['key'];
export type LeadWeights = Record<LeadFactor, number>;

export const DEFAULT_LEAD_WEIGHTS: LeadWeights = {
  icp_fit: 25,
  clear_need: 20,
  scale: 15,
  timeline: 15,
  authority: 10,
  engagement: 10,
  meeting_intent: 5,
};

export const DEFAULT_CHAT_CONSENT_TEXT =
  'I agree that PaceMakers may store my name and contact details with this conversation and contact me about my enquiry. I can ask for them to be deleted at any time.';

export const ENGINE_LIMITS = {
  keywords: 50,
  keyword: 120,
  feedMax: { min: 1, max: 50 },
  chatMessages: { min: 4, max: 100 },
  chatPerIp: { min: 1, max: 100 },
  checkinDays: { min: 7, max: 730 },
  consentText: 1000,
} as const;

export type EngineSettings = {
  signal_keywords: string[];
  signal_feed_paused: boolean;
  signal_feed_max_per_run: number;
  scoring_weights: ScoringWeights;
  agent_models: Record<string, string>;
  outreach_sending_paused: boolean;
  lead_scoring_weights: LeadWeights;
  chat_widget_enabled: boolean;
  chat_max_messages: number;
  chat_max_conversations_per_ip_per_day: number;
  chat_consent_text: string;
  lead_alert_email: string;
  bookings_url: string;
  nurture_enabled: boolean;
  partner_checkin_days: number;
};

export type EngineSettingKey = keyof EngineSettings;

/** Each setting, its default, and the migration that adds its column. */
export const ENGINE_SETTING_COLUMNS: Record<EngineSettingKey, { migration: string; default: EngineSettings[EngineSettingKey] }> = {
  signal_keywords: { migration: '088_growth_prospecting.sql', default: [] },
  signal_feed_paused: { migration: '088_growth_prospecting.sql', default: false },
  signal_feed_max_per_run: { migration: '088_growth_prospecting.sql', default: 10 },
  scoring_weights: { migration: '088_growth_prospecting.sql', default: DEFAULT_SCORING_WEIGHTS },
  agent_models: { migration: '088_growth_prospecting.sql', default: {} },
  outreach_sending_paused: { migration: '089_growth_outreach.sql', default: false },
  lead_scoring_weights: { migration: '089_growth_outreach.sql', default: DEFAULT_LEAD_WEIGHTS },
  chat_widget_enabled: { migration: '090_growth_website_chat.sql', default: false },
  chat_max_messages: { migration: '090_growth_website_chat.sql', default: 30 },
  chat_max_conversations_per_ip_per_day: { migration: '090_growth_website_chat.sql', default: 5 },
  chat_consent_text: { migration: '090_growth_website_chat.sql', default: DEFAULT_CHAT_CONSENT_TEXT },
  lead_alert_email: { migration: '090_growth_website_chat.sql', default: 'ahmad.din@pacemakersglobal.com' },
  bookings_url: { migration: '091_growth_meetings.sql', default: '' },
  nurture_enabled: { migration: '092_growth_nurture_partners.sql', default: false },
  partner_checkin_days: { migration: '092_growth_nurture_partners.sql', default: 90 },
};

export const ENGINE_SETTING_KEYS = Object.keys(ENGINE_SETTING_COLUMNS) as EngineSettingKey[];

export const DEFAULT_ENGINE_SETTINGS = Object.fromEntries(ENGINE_SETTING_KEYS.map((k) => [k, ENGINE_SETTING_COLUMNS[k].default])) as EngineSettings;

const weightsSchema = <K extends string>(keys: readonly K[]) =>
  z
    .record(z.string(), z.number().int().min(0).max(100))
    .refine((w) => keys.every((k) => k in w) && Object.keys(w).length === keys.length, 'Give every factor a weight')
    .refine((w) => Object.values(w).reduce((a, b) => a + b, 0) === 100, 'The weights must add up to 100')
    .transform((w) => w as Record<K, number>);

export const scoringWeightsSchema = weightsSchema(SCORING_FACTORS.map((f) => f.key));
export const leadWeightsSchema = weightsSchema(LEAD_FACTORS.map((f) => f.key));

const keyword = z.string().trim().min(2, 'A keyword needs at least two characters').max(ENGINE_LIMITS.keyword);

/** One group of engine settings per settings form. Each saves only its own columns. */
export const engineGroupSchemas = {
  signal_feed: z.object({
    signal_keywords: z
      .array(keyword)
      .max(ENGINE_LIMITS.keywords)
      .transform((a) => [...new Set(a.map((k) => k.replace(/\s+/g, ' ')))]),
    signal_feed_paused: z.boolean(),
    signal_feed_max_per_run: z.number().int().min(ENGINE_LIMITS.feedMax.min).max(ENGINE_LIMITS.feedMax.max),
  }),
  scoring: z.object({ scoring_weights: scoringWeightsSchema }),
  agent_models: z.object({
    agent_models: z.record(z.string().regex(/^[a-z0-9-]+$/), z.string().refine((m) => m in MODEL_PRICES, 'Not a priced model')),
  }),
  outreach: z.object({ outreach_sending_paused: z.boolean(), lead_scoring_weights: leadWeightsSchema }),
  chat: z.object({
    chat_widget_enabled: z.boolean(),
    chat_max_messages: z.number().int().min(ENGINE_LIMITS.chatMessages.min).max(ENGINE_LIMITS.chatMessages.max),
    chat_max_conversations_per_ip_per_day: z.number().int().min(ENGINE_LIMITS.chatPerIp.min).max(ENGINE_LIMITS.chatPerIp.max),
    chat_consent_text: z.string().trim().min(20).max(ENGINE_LIMITS.consentText),
    lead_alert_email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  }),
  meetings: z.object({
    bookings_url: z
      .string()
      .trim()
      .max(500)
      .refine((u) => u === '' || /^https:\/\/[^\s]+$/.test(u), 'Use a full https:// link, or leave it empty'),
  }),
  nurture: z.object({
    nurture_enabled: z.boolean(),
    partner_checkin_days: z.number().int().min(ENGINE_LIMITS.checkinDays.min).max(ENGINE_LIMITS.checkinDays.max),
  }),
} as const;

export type EngineGroup = keyof typeof engineGroupSchemas;
export const ENGINE_GROUPS = Object.keys(engineGroupSchemas) as EngineGroup[];

/** Normalise one column value as read from the database, falling back to the default when it is malformed. */
export function readEngineValue<K extends EngineSettingKey>(key: K, raw: unknown): EngineSettings[K] {
  const d = ENGINE_SETTING_COLUMNS[key].default as EngineSettings[K];
  if (raw === null || raw === undefined) return d;
  if (Array.isArray(d)) return (Array.isArray(raw) ? raw.filter((x) => typeof x === 'string') : d) as EngineSettings[K];
  if (typeof d === 'boolean') return (typeof raw === 'boolean' ? raw : d) as EngineSettings[K];
  if (typeof d === 'number') return (typeof raw === 'number' ? raw : Number.isFinite(Number(raw)) ? Number(raw) : d) as EngineSettings[K];
  if (typeof d === 'string') return (typeof raw === 'string' ? raw : d) as EngineSettings[K];
  return (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : d) as EngineSettings[K];
}
