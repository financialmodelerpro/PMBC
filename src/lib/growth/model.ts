/**
 * The Growth Engine's data model (Unit 1.2, 2026-09-22): the value lists,
 * business rules and row shapes behind migration 083.
 *
 * Every list here is mirrored in a CHECK constraint in the Growth migrations
 * (083, and 086 for services), and `npm run verify-growth-data` fails if they
 * drift. Change both together, the SQL by a new migration.
 *
 * Pure: no database access, so verifiers and later units import it freely.
 */

import { SERVICES } from '@/config/services';

/**
 * The Growth services are the public site's nine services (Unit 1.3b), read
 * from src/config/services.ts so the two lists cannot drift. The value is the
 * site slug, and each service's page is /services/<slug>.
 */
export const GROWTH_SERVICES: readonly { value: string; label: string; href: string }[] = SERVICES.map((s) => ({
  value: s.slug,
  label: s.title,
  href: `/services/${s.slug}`,
}));
/** A site service slug. Checked at runtime against GROWTH_SERVICES; the database holds the same nine. */
export type GrowthService = string;

export function isGrowthService(value: unknown): value is GrowthService {
  return typeof value === 'string' && GROWTH_SERVICES.some((s) => s.value === value);
}

export function growthServiceLabel(value: string): string {
  return GROWTH_SERVICES.find((s) => s.value === value)?.label ?? value;
}

/** Priority services for outreach until Ahmad changes them in Settings (migration 086 default). */
export const DEFAULT_PRIORITY_SERVICES: readonly string[] = ['financial-modeling', 'business-valuation', 'financial-due-diligence', 'mergers-acquisitions', 'refm'];

/** Minimum deal size, SAR. Mirrored in the generated `growth_leads.below_minimum`. */
export const MINIMUM_DEAL_SIZE_SAR = 50_000_000;

export const PIPELINE_STAGES = [
  { value: 'prospect', label: 'Prospect' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'replied', label: 'Replied' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'meeting_booked', label: 'Meeting Booked' },
  { value: 'opportunity', label: 'Opportunity' },
  { value: 'proposal', label: 'Proposal' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
  { value: 'nurture', label: 'Nurture' },
] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number]['value'];

export const PROSPECT_BANDS = [
  { value: 'priority', label: 'Priority' },
  { value: 'good', label: 'Good' },
  { value: 'watch', label: 'Watch' },
  { value: 'low', label: 'Low' },
] as const;
export type ProspectBand = (typeof PROSPECT_BANDS)[number]['value'];

export const LEAD_TEMPERATURES = [
  { value: 'hot', label: 'Hot' },
  { value: 'warm', label: 'Warm' },
  { value: 'cold', label: 'Cold' },
] as const;
export type LeadTemperature = (typeof LEAD_TEMPERATURES)[number]['value'];

export const TRIGGER_TYPES = [
  { value: 'new_project', label: 'New project' },
  { value: 'fundraising_debt', label: 'Fundraising or debt' },
  { value: 'off_plan_registration', label: 'Off-plan registration' },
  { value: 'market_entry', label: 'Market entry' },
  { value: 'finance_leadership_hire', label: 'Finance leadership hire' },
  { value: 'contract_award', label: 'Contract award' },
  { value: 'acquisition_jv', label: 'Acquisition or JV' },
  { value: 'capital_market_activity', label: 'Capital market activity' },
  { value: 'expansion', label: 'Expansion' },
  { value: 'other', label: 'Other' },
] as const;
export type TriggerType = (typeof TRIGGER_TYPES)[number]['value'];

export const LEAD_SOURCES = [
  { value: 'outbound', label: 'Outbound' },
  { value: 'website', label: 'Website' },
  { value: 'referral', label: 'Referral' },
  { value: 'partner', label: 'Partner' },
  { value: 'tool', label: 'Tool' },
  { value: 'pilot', label: 'Pilot' },
  { value: 'other', label: 'Other' },
] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number]['value'];

export const SIGNAL_STATUSES = [
  { value: 'new', label: 'New' },
  { value: 'converted', label: 'Converted' },
  { value: 'attached', label: 'Attached' },
  { value: 'dismissed', label: 'Dismissed' },
] as const;
export type SignalStatus = (typeof SIGNAL_STATUSES)[number]['value'];

export const COMPANY_STATUSES = [
  { value: 'new', label: 'New' },
  { value: 'researching', label: 'Researching' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'client', label: 'Client' },
  { value: 'disqualified', label: 'Disqualified' },
  { value: 'archived', label: 'Archived' },
] as const;
export type CompanyStatus = (typeof COMPANY_STATUSES)[number]['value'];

export const CONSENT_STATUSES = [
  { value: 'unknown', label: 'Unknown' },
  { value: 'legitimate_interest', label: 'Legitimate interest' },
  { value: 'opted_in', label: 'Opted in' },
  { value: 'opted_out', label: 'Opted out' },
  { value: 'do_not_contact', label: 'Do not contact' },
] as const;
export type ConsentStatus = (typeof CONSENT_STATUSES)[number]['value'];

export const ACTOR_TYPES = ['admin', 'system', 'ai'] as const;
export type ActorType = (typeof ACTOR_TYPES)[number];

export const DEFAULT_COMPANY_COUNTRY = 'Saudi Arabia';

/** Below the minimum only when a deal size is known, as the database computes it. */
export function isBelowMinimum(dealSizeSar: number | null | undefined): boolean {
  return dealSizeSar !== null && dealSizeSar !== undefined && dealSizeSar < MINIMUM_DEAL_SIZE_SAR;
}

/**
 * A website domain as the database stores it: lower case, no scheme, no `www.`,
 * no path, query or port. Returns null when nothing usable is left.
 */
export function normaliseDomain(input: string | null | undefined): string | null {
  if (!input) return null;
  let s = input.trim().toLowerCase();
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
  s = s.replace(/^www\./, '');
  s = s.split(/[/?#]/)[0].split(':')[0].replace(/\.+$/, '');
  return s || null;
}

/** An email as the database stores it: trimmed and lower case. Null when empty. */
export function normaliseEmail(input: string | null | undefined): string | null {
  const s = input?.trim().toLowerCase();
  return s || null;
}

export type GrowthCompany = {
  id: string;
  created_at: string;
  updated_at: string;
  is_test: boolean;
  name: string;
  website_domain: string | null;
  sector: string | null;
  city: string | null;
  country: string;
  description: string | null;
  linkedin_url: string | null;
  likely_service: GrowthService | null;
  status: CompanyStatus;
  notes: string | null;
};

export type GrowthContact = {
  id: string;
  created_at: string;
  updated_at: string;
  is_test: boolean;
  company_id: string | null;
  full_name: string;
  role_title: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  is_decision_maker: boolean;
  consent_status: ConsentStatus;
  consent_source: string | null;
  consent_at: string | null;
  last_contacted_at: string | null;
  notes: string | null;
};

export type GrowthLead = {
  id: string;
  created_at: string;
  updated_at: string;
  is_test: boolean;
  company_id: string | null;
  contact_id: string | null;
  title: string;
  stage: PipelineStage;
  stage_changed_at: string;
  prospect_score: number | null;
  prospect_band: ProspectBand | null;
  lead_score: number | null;
  lead_temperature: LeadTemperature | null;
  score_reasons: string[];
  score_override: boolean;
  override_reason: string | null;
  recommended_service: GrowthService | null;
  requirement: string | null;
  /** NUMERIC: PostgREST may return it as a number or a string. */
  deal_size_sar: number | string | null;
  /** Generated by the database from deal_size_sar; never written. */
  below_minimum: boolean;
  timeline: string | null;
  source: LeadSource;
  source_ref: string | null;
  next_action: string | null;
  next_action_due: string | null;
  lost_reason: string | null;
};

export type GrowthSignal = {
  id: string;
  created_at: string;
  updated_at: string;
  is_test: boolean;
  company_id: string | null;
  company_name: string | null;
  lead_id: string | null;
  trigger_type: TriggerType;
  signal_date: string;
  summary: string;
  evidence_url: string;
  source_name: string | null;
  status: SignalStatus;
  dismissed_reason: string | null;
};

export type GrowthActivity = {
  id: string;
  created_at: string;
  is_test: boolean;
  company_id: string | null;
  contact_id: string | null;
  lead_id: string | null;
  signal_id: string | null;
  actor_type: ActorType;
  actor_id: string | null;
  action: string;
  summary: string | null;
  metadata: Record<string, unknown>;
};
