/**
 * Reading and changing the Growth settings row (migration 085). Server only.
 *
 * `getGrowthSettings` is how every later unit reads its limits. It reports
 * whether the row was read; when it was not, callers that send or spend must
 * refuse to act rather than fall back to the defaults.
 */

import { isMissingSchema } from '@/lib/tools/db';

import { growthDb } from './db';
import type { Actor } from './kb';
import { DEFAULT_SETTINGS, hhmm, type GrowthSettings, type SettingsInput } from './settingsModel';

export type SettingsRead = { settings: GrowthSettings; source: 'database' | 'missing' | 'error'; updatedAt: string | null; updatedBy: string | null; error: string | null };

const COLUMNS =
  'daily_cold_email_cap, send_timezone, send_days, send_start, send_end, follow_up_days, max_follow_ups, ai_monthly_budget_usd, ai_alert_threshold_pct, ai_alert_email, retention_months, updated_at, updated_by_name';

type Row = Omit<GrowthSettings, 'ai_monthly_budget_usd'> & { ai_monthly_budget_usd: number | string | null; updated_at: string; updated_by_name: string | null };

function fromRow(r: Row): GrowthSettings {
  return {
    daily_cold_email_cap: r.daily_cold_email_cap,
    send_timezone: r.send_timezone,
    send_days: r.send_days,
    send_start: hhmm(r.send_start),
    send_end: hhmm(r.send_end),
    follow_up_days: r.follow_up_days,
    max_follow_ups: r.max_follow_ups,
    ai_monthly_budget_usd: r.ai_monthly_budget_usd === null ? null : Number(r.ai_monthly_budget_usd),
    ai_alert_threshold_pct: r.ai_alert_threshold_pct,
    ai_alert_email: r.ai_alert_email,
    retention_months: r.retention_months,
  };
}

export async function getGrowthSettings(): Promise<SettingsRead> {
  try {
    const { data, error } = await growthDb().from('growth_settings').select(COLUMNS).eq('id', 1).maybeSingle();
    if (error) return { settings: DEFAULT_SETTINGS, source: isMissingSchema(error) ? 'missing' : 'error', updatedAt: null, updatedBy: null, error: error.message ?? null };
    if (!data) return { settings: DEFAULT_SETTINGS, source: 'missing', updatedAt: null, updatedBy: null, error: 'The settings row is missing' };
    const row = data as unknown as Row;
    return { settings: fromRow(row), source: 'database', updatedAt: row.updated_at, updatedBy: row.updated_by_name, error: null };
  } catch (err) {
    return { settings: DEFAULT_SETTINGS, source: 'error', updatedAt: null, updatedBy: null, error: err instanceof Error ? err.message : 'read failed' };
  }
}

export type SettingsWrite = { ok: true; settings: GrowthSettings } | { ok: false; status: number; error: string };

/**
 * Saves the whole settings row. The database checks every limit again and a
 * trigger logs each changed field's old and new value with the actor.
 * `isTest` marks a verifier's change so its log rows are test rows.
 */
export async function updateGrowthSettings(input: SettingsInput, actor: Actor, opts: { isTest?: boolean } = {}): Promise<SettingsWrite> {
  const { data, error } = await growthDb()
    .from('growth_settings')
    .update({ ...input, updated_by: actor.id, updated_by_name: actor.name, last_change_is_test: Boolean(opts.isTest) })
    .eq('id', 1)
    .select(COLUMNS)
    .maybeSingle();
  if (error) {
    if (isMissingSchema(error)) return { ok: false, status: 503, error: 'The settings table is missing. Apply 085_growth_settings.sql.' };
    if (error.code === '23514') return { ok: false, status: 422, error: 'The database refused a value outside its limits' };
    return { ok: false, status: 500, error: error.message ?? 'Save failed' };
  }
  if (!data) return { ok: false, status: 503, error: 'The settings row is missing. Apply 085_growth_settings.sql.' };
  return { ok: true, settings: fromRow(data as unknown as Row) };
}
