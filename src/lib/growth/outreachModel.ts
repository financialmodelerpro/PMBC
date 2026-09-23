/**
 * Outreach rules (Units 3.1 to 3.3, 2026-09-23). Pure: the sending window and
 * daily cap, follow-up timing, placeholder checks and the email body, shared
 * by the sender, the admin screens and the verifier.
 *
 * Times are Saudi time (UTC+3 all year). Sending days are 0 Sunday to 6
 * Saturday, and the window runs from send_start up to send_end.
 */

import { z } from 'zod';

import { SITE_HREF } from '@/lib/brand/letterhead';

import type { GrowthSettings } from './settingsModel';

const RIYADH_MS = 3 * 3_600_000;

export const MESSAGE_STATUSES = ['draft', 'approved', 'rejected', 'scheduled', 'sent', 'failed', 'cancelled'] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];
export type MessageChannel = 'email' | 'linkedin';
export type MessageKind = 'initial' | 'follow_up' | 'recap' | 'no_show' | 'manual' | 'nurture' | 'lead_magnet';

/** Kinds that count against the daily cold email cap. */
export const COLD_KINDS: readonly MessageKind[] = ['initial', 'follow_up'];

export const OUTREACH_LIMITS = { subject: 200, body: 6000, reason: 500 } as const;

type Window = Pick<GrowthSettings, 'send_days' | 'send_start' | 'send_end'>;

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/** Riyadh wall-clock parts of an instant. */
export function riyadhParts(now: Date): { date: string; weekday: number; minute: number } {
  const local = new Date(now.getTime() + RIYADH_MS);
  return { date: local.toISOString().slice(0, 10), weekday: local.getUTCDay(), minute: local.getUTCHours() * 60 + local.getUTCMinutes() };
}

/** The instant of a Riyadh date and minute of day. */
function riyadhInstant(date: string, minute: number): Date {
  return new Date(Date.parse(`${date}T00:00:00Z`) - RIYADH_MS + minute * 60_000);
}

export function inSendingWindow(s: Window, now: Date): boolean {
  const p = riyadhParts(now);
  return s.send_days.includes(p.weekday) && p.minute >= minutes(s.send_start) && p.minute < minutes(s.send_end);
}

/** The start of the next sending window at or after `now` (now itself when inside one). */
export function nextWindowStart(s: Window, now: Date): Date {
  if (inSendingWindow(s, now)) return now;
  const p = riyadhParts(now);
  for (let d = 0; d < 8; d++) {
    const date = new Date(Date.parse(`${p.date}T00:00:00Z`) + d * 86_400_000).toISOString().slice(0, 10);
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    if (!s.send_days.includes(weekday)) continue;
    const start = riyadhInstant(date, minutes(s.send_start));
    if (start.getTime() > now.getTime()) return start;
  }
  return new Date(now.getTime() + 86_400_000);
}

/** The first window on a later Riyadh day than `now` (for when today's cap is used up). */
export function nextDayWindowStart(s: Window, now: Date): Date {
  const p = riyadhParts(now);
  const tomorrow = riyadhInstant(new Date(Date.parse(`${p.date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10), 0);
  return nextWindowStart(s, tomorrow);
}

/** The Riyadh day's bounds in UTC, for counting today's sends. */
export function riyadhDayBounds(now: Date): { start: Date; end: Date } {
  const p = riyadhParts(now);
  const start = riyadhInstant(p.date, 0);
  return { start, end: new Date(start.getTime() + 86_400_000) };
}

export type SendDecision = { action: 'send' } | { action: 'schedule'; at: Date; why: string } | { action: 'refuse'; why: string };

/**
 * Whether a cold email may go now. Outside the window it waits for the next
 * window; at the cap it waits for the next day's window.
 */
export function sendDecision(s: Window & Pick<GrowthSettings, 'daily_cold_email_cap'>, sentToday: number, now: Date, opts: { paused: boolean; counts: boolean }): SendDecision {
  if (opts.paused) return { action: 'refuse', why: 'Outreach sending is paused in Settings' };
  if (!inSendingWindow(s, now)) return { action: 'schedule', at: nextWindowStart(s, now), why: 'outside the sending window' };
  if (opts.counts && sentToday >= s.daily_cold_email_cap) return { action: 'schedule', at: nextDayWindowStart(s, now), why: `today's cap of ${s.daily_cold_email_cap} is reached` };
  return { action: 'send' };
}

/**
 * When follow-up `step` (1-based) is due: `follow_up_days` counts days after
 * the first send. Null when the sequence allows no more follow-ups.
 */
export function followUpDue(startedAt: string | Date, step: number, s: Pick<GrowthSettings, 'follow_up_days' | 'max_follow_ups'>): Date | null {
  if (step < 1 || step > s.max_follow_ups || step > s.follow_up_days.length) return null;
  return new Date(new Date(startedAt).getTime() + s.follow_up_days[step - 1] * 86_400_000);
}

/** Square-bracket placeholders left in a draft, other than the link, which is filled at send time. */
export function unresolvedPlaceholders(text: string): string[] {
  return [...new Set((text.match(/\[[A-Za-z][A-Za-z ]{0,40}\]/g) ?? []).filter((p) => p !== '[Link]'))];
}

export const LINK_PLACEHOLDER = '[Link]';

/** Words in a reply that mean "stop": the reply is treated as an opt-out. */
export const OPT_OUT_REPLY = /\b(unsubscribe|remove me|opt[ -]?out|stop (emailing|contacting)|do not contact|no longer interested)\b/i;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const OPT_OUT_LINE = 'If you would prefer not to hear from me again, use this link and I will not write again:';

/**
 * The email as sent: the body's paragraphs, the link placeholder replaced by
 * the tracked link (or, if the draft has none, the link on its own line), and
 * the opt-out line with its link at the foot of every email.
 */
export function buildEmail(input: { body: string; linkUrl: string | null; optOutUrl: string }): { html: string; text: string } {
  let body = input.body.trim();
  if (input.linkUrl) body = body.includes(LINK_PLACEHOLDER) ? body.split(LINK_PLACEHOLDER).join(input.linkUrl) : `${body}\n\n${input.linkUrl}`;
  else body = body.split(LINK_PLACEHOLDER).join(SITE_HREF);
  const text = `${body}\n\n--\n${OPT_OUT_LINE} ${input.optOutUrl}`;
  const linkify = (s: string) => esc(s).replace(/https?:\/\/[^\s<]+/g, (u) => `<a href="${u}">${u}</a>`);
  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px">${linkify(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:#0F1B2D">${paragraphs}<p style="margin:24px 0 0;font-size:12px;color:#6B7280">${esc(OPT_OUT_LINE)} <a href="${esc(input.optOutUrl)}">${esc(input.optOutUrl)}</a></p></div>`;
  return { html, text };
}

/** The public URLs, always on the site's own domain. */
export const trackedUrl = (token: string) => `${SITE_HREF}/api/growth/l/${token}`;
export const optOutUrl = (token: string) => `${SITE_HREF}/api/growth/o/${token}`;

export const draftRequestSchema = z.object({
  lead_id: z.string().uuid(),
  channel: z.enum(['email', 'linkedin']),
});

export const messageEditSchema = z.object({
  subject: z.string().trim().max(OUTREACH_LIMITS.subject).nullable().optional(),
  body: z.string().trim().min(1, 'The message is empty').max(OUTREACH_LIMITS.body),
});

export const messageActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('approve') }),
  z.object({ action: z.literal('reject'), reason: z.string().trim().min(3, 'Give a reason').max(OUTREACH_LIMITS.reason) }),
  z.object({ action: z.literal('send') }),
  z.object({ action: z.literal('mark_sent') }),
  z.object({ action: z.literal('mark_replied'), note: z.string().trim().max(1000).optional() }),
  z.object({ action: z.literal('cancel'), reason: z.string().trim().min(3).max(OUTREACH_LIMITS.reason) }),
]);
export type MessageAction = z.infer<typeof messageActionSchema>;

export const VALUE_BANDS = [
  { value: 'unknown', label: 'Not known yet' },
  { value: 'under_100k', label: 'Under SAR 100,000' },
  { value: '100k_250k', label: 'SAR 100,000 to 250,000' },
  { value: '250k_500k', label: 'SAR 250,000 to 500,000' },
  { value: '500k_1m', label: 'SAR 500,000 to 1 million' },
  { value: 'over_1m', label: 'Over SAR 1 million' },
] as const;
