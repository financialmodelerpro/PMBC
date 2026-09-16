/**
 * Database access for the free tools tables, and the one rule they share: a
 * missing table is a normal state, not an error.
 *
 * The three tables (`tool_visibility`, `tool_leads`, `tool_lead_events`) are
 * created by hand-run DDL migrations 076 and 077, and the code that reads them
 * may deploy first. Every reader here answers "table missing" with the safe
 * default (tools Hidden, no leads) rather than throwing, and reports it so an
 * admin screen can say "migration not applied" instead of crashing.
 *
 * The tables are not in `src/types/database.ts`, which is generated from the
 * live schema, so they are reached through an untyped client and given their
 * shapes here.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { createSupabaseServerClient } from '@/lib/supabase/server';

export function toolsDb(): SupabaseClient {
  return createSupabaseServerClient() as unknown as SupabaseClient;
}

type PgError = { code?: string; message?: string } | null | undefined;

/**
 * True when Postgres or PostgREST says the relation or a column does not exist.
 *
 * 42P01 is Postgres's undefined_table, 42703 undefined_column. PostgREST
 * reports a table absent from its schema cache as PGRST205 (older versions
 * PGRST200 or a 404-style message), so the message is checked as well.
 */
export function isMissingSchema(error: PgError): boolean {
  if (!error) return false;
  if (error.code === '42P01' || error.code === '42703' || error.code === 'PGRST205' || error.code === 'PGRST204') {
    return true;
  }
  const m = (error.message ?? '').toLowerCase();
  return (
    (m.includes('relation') && m.includes('does not exist')) ||
    m.includes('could not find the table') ||
    m.includes('schema cache')
  );
}

export type ToolVisibilityStatus = 'hidden' | 'live';

export type ToolVisibilityRow = {
  slug: string;
  status: ToolVisibilityStatus;
  updated_at: string | null;
  updated_by: string | null;
};

export type EmailStatus =
  | 'pending'
  | 'sent'
  | 'not_configured'
  | 'failed'
  | 'delivered'
  | 'opened'
  | 'clicked'
  | 'deferred'
  | 'bounced'
  | 'complaint'
  | 'blocked';

export type LeadStatus = 'new' | 'read' | 'responded' | 'archived';

export type ToolLeadRow = {
  id: string;
  created_at: string;
  tool_slug: string;
  is_test: boolean;
  data_version: string;
  name: string;
  email: string;
  company: string | null;
  purpose: string | null;
  deal_size_band: string | null;
  below_minimum: boolean;
  country: string | null;
  currency: string | null;
  industry: string | null;
  inputs: unknown;
  results: unknown;
  equity_low: number | null;
  equity_mid: number | null;
  equity_high: number | null;
  wacc: number | null;
  consent_given: boolean;
  consent_at: string | null;
  consent_text: string | null;
  follow_up_consent: boolean;
  follow_up_consent_at: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  referrer: string | null;
  landing_path: string | null;
  ip_hash: string | null;
  user_agent: string | null;
  status: LeadStatus;
  notes: string | null;
  access_token: string;
  email_status: EmailStatus;
  email_message_id: string | null;
  email_sent_at: string | null;
  email_error: string | null;
  email_last_event_at: string | null;
  alert_status: EmailStatus;
  alert_message_id: string | null;
  alert_error: string | null;
  booking_clicks: number;
  last_booking_click_at: string | null;
};

export type ToolLeadEventRow = {
  id: string;
  lead_id: string;
  created_at: string;
  occurred_at: string;
  event_type: string;
  source: 'brevo' | 'results' | 'email' | 'admin' | 'system';
  email_kind: 'results' | 'alert' | null;
  message_id: string | null;
  link: string | null;
  detail: string | null;
  payload: unknown;
  dedupe_key: string | null;
};
