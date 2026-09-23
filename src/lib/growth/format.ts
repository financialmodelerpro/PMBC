/**
 * Display helpers for the Growth admin (from Phase 2, 2026-09-23). Pure, safe
 * in server and client components.
 */

import { PROSPECT_BANDS, LEAD_TEMPERATURES, PIPELINE_STAGES, LEAD_SOURCES, growthServiceLabel } from './model';

export const day = (iso: string | null | undefined) =>
  iso ? new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Riyadh' }) : '';

export const dateTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Riyadh' }) : '';

export function sar(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  if (n >= 1_000_000_000) return `SAR ${(n / 1_000_000_000).toLocaleString('en-GB', { maximumFractionDigits: 2 })} billion`;
  if (n >= 1_000_000) return `SAR ${(n / 1_000_000).toLocaleString('en-GB', { maximumFractionDigits: 1 })} million`;
  return `SAR ${n.toLocaleString('en-GB')}`;
}

export type Tone = 'neutral' | 'success' | 'warning' | 'danger';

export const bandLabel = (b: string | null | undefined) => PROSPECT_BANDS.find((x) => x.value === b)?.label ?? 'Not scored';
export const bandTone = (b: string | null | undefined): Tone => (b === 'priority' ? 'success' : b === 'good' ? 'success' : b === 'watch' ? 'warning' : b === 'low' ? 'danger' : 'neutral');
export const temperatureLabel = (t: string | null | undefined) => LEAD_TEMPERATURES.find((x) => x.value === t)?.label ?? 'Not scored';
export const temperatureTone = (t: string | null | undefined): Tone => (t === 'hot' ? 'danger' : t === 'warm' ? 'warning' : 'neutral');
export const stageLabel = (s: string | null | undefined) => PIPELINE_STAGES.find((x) => x.value === s)?.label ?? s ?? '';
export const sourceLabel = (s: string | null | undefined) => LEAD_SOURCES.find((x) => x.value === s)?.label ?? s ?? '';
export const serviceLabel = (s: string | null | undefined) => (s ? growthServiceLabel(s) : '');

/** The Riyadh calendar date for an instant, YYYY-MM-DD. */
export function riyadhDate(now: Date = new Date()): string {
  return new Date(now.getTime() + 3 * 3_600_000).toISOString().slice(0, 10);
}
