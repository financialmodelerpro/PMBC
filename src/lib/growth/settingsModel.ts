/**
 * Growth Engine settings (Unit 1.4, 2026-09-22): defaults, limits and
 * validation for the one `growth_settings` row (migration 085).
 *
 * Pure. Every limit here is also a CHECK constraint in the migration, so a
 * value the form lets through and the database refuses cannot exist; the
 * verifier compares them. Later units read settings through
 * `getGrowthSettings` in settings.ts, never from constants here.
 */

import { z } from 'zod';

export const SEND_TIMEZONE = 'Asia/Riyadh';

/** 0 Sunday to 6 Saturday, as the database stores them. */
export const WEEKDAYS = [
  { value: 0, label: 'Sunday', short: 'Sun' },
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
] as const;

export const SETTINGS_LIMITS = {
  dailyCap: { min: 1, max: 500 },
  followUpDay: { min: 1, max: 365 },
  followUpCount: { min: 1, max: 10 },
  maxFollowUps: { min: 0, max: 10 },
  budgetUsd: { min: 0.01, max: 100_000 },
  thresholdPct: { min: 1, max: 100 },
  retentionMonths: { min: 1, max: 120 },
} as const;

export type GrowthSettings = {
  daily_cold_email_cap: number;
  send_timezone: string;
  send_days: number[];
  /** HH:MM, Saudi time. */
  send_start: string;
  send_end: string;
  follow_up_days: number[];
  max_follow_ups: number;
  /** Null until set; Unit 1.5 refuses to spend while it is null. */
  ai_monthly_budget_usd: number | null;
  ai_alert_threshold_pct: number;
  ai_alert_email: string;
  retention_months: number;
};

export const DEFAULT_SETTINGS: GrowthSettings = {
  daily_cold_email_cap: 10,
  send_timezone: SEND_TIMEZONE,
  send_days: [0, 1, 2, 3, 4],
  send_start: '09:00',
  send_end: '17:00',
  follow_up_days: [4, 10, 20],
  max_follow_ups: 3,
  ai_monthly_budget_usd: null,
  ai_alert_threshold_pct: 80,
  ai_alert_email: 'ahmad.din@pacemakersglobal.com',
  retention_months: 12,
};

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const increasing = (a: number[]) => a.every((v, i) => i === 0 || v > a[i - 1]);

/** "4, 10, 20" or "4 10 20" to [4, 10, 20]; anything unreadable becomes NaN so validation refuses it. */
export function parseDayList(input: string): number[] {
  return input
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((x) => (/^\d+$/.test(x) ? Number(x) : Number.NaN));
}

/** The whole settings row as the admin form submits it. */
export const settingsSchema = z
  .object({
    daily_cold_email_cap: z.number().int().min(SETTINGS_LIMITS.dailyCap.min).max(SETTINGS_LIMITS.dailyCap.max),
    send_days: z
      .array(z.number().int().min(0).max(6))
      .min(1, 'Choose at least one sending day')
      .max(7)
      .refine(increasing, 'Sending days must not repeat'),
    send_start: z.string().regex(TIME, 'Use HH:MM'),
    send_end: z.string().regex(TIME, 'Use HH:MM'),
    follow_up_days: z
      .array(z.number().int().min(SETTINGS_LIMITS.followUpDay.min).max(SETTINGS_LIMITS.followUpDay.max))
      .min(SETTINGS_LIMITS.followUpCount.min, 'Give at least one follow-up day')
      .max(SETTINGS_LIMITS.followUpCount.max)
      .refine(increasing, 'Follow-up days must increase, for example 4, 10, 20'),
    max_follow_ups: z.number().int().min(SETTINGS_LIMITS.maxFollowUps.min).max(SETTINGS_LIMITS.maxFollowUps.max),
    ai_monthly_budget_usd: z.number().min(SETTINGS_LIMITS.budgetUsd.min, 'The budget must be more than zero').max(SETTINGS_LIMITS.budgetUsd.max).nullable(),
    ai_alert_threshold_pct: z.number().int().min(SETTINGS_LIMITS.thresholdPct.min).max(SETTINGS_LIMITS.thresholdPct.max),
    ai_alert_email: z.string().trim().toLowerCase().email('Enter a valid email address'),
    retention_months: z.number().int().min(SETTINGS_LIMITS.retentionMonths.min).max(SETTINGS_LIMITS.retentionMonths.max),
  })
  .refine((s) => s.send_start < s.send_end, { message: 'The sending window must end after it starts', path: ['send_end'] })
  .refine((s) => s.max_follow_ups <= s.follow_up_days.length, { message: 'Maximum follow-ups cannot exceed the number of follow-up days', path: ['max_follow_ups'] });

export type SettingsInput = z.infer<typeof settingsSchema>;

/** The database returns TIME as HH:MM:SS; the form and the logs use HH:MM. */
export function hhmm(time: string): string {
  return time.slice(0, 5);
}

export function describeDays(days: number[]): string {
  return days.map((d) => WEEKDAYS[d]?.short ?? String(d)).join(', ');
}
