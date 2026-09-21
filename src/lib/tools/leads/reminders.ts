/**
 * Follow-up reminders for the free tools (since 2026-09-21). Two only, on day 7 and day 14 after a
 * person's latest valuation, and only to a person who ticked the follow-up box on it. They stop for
 * good once the person unsubscribes or books a call (a meeting scheduled on /book, not a click).
 *
 * One person is one email: a person with three valuations gets two reminders, not six, counted from
 * their most recent valuation. Each reminder is sent only inside its own week (day 7 to 13, day 14 to
 * 20), so a person who valued weeks before this shipped is not sent a late "day 7" reminder, and the
 * second never goes before the first.
 *
 * Pure: the database runner (`runReminders.ts`) and the verifier both drive these functions.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

import { SITE_HREF } from '@/lib/brand/letterhead';

export const REMINDER_DAYS = [7, 14] as const;
/** Each reminder's window, days: sent on the first daily run inside it, never after it closes. */
export const REMINDER_WINDOW_DAYS = 7;

export const REMINDER_EVENT = 'reminder_sent';
export const UNSUBSCRIBED_EVENT = 'reminders_unsubscribed';
export const BOOKED_EVENT = 'booking_scheduled';
export const REMINDER_TAG = 'tool-reminder';

export const reminderDedupeKey = (email: string, n: number) => `${REMINDER_EVENT}:${email.trim().toLowerCase()}:${n}`;

export type ReminderPerson = {
  email: string;
  name: string;
  /** The latest valuation: the reminder is about it and counts from it. */
  latestLeadId: string;
  latestAt: string;
  latestCompany: string | null;
  toolSlug: string;
  /** The follow-up box on the latest valuation. */
  followUp: boolean;
  unsubscribed: boolean;
  booked: boolean;
  /** Reminders already sent to this email, 1 and or 2. */
  sent: number[];
};

/** Which reminder is due now, or null. */
export function dueReminder(p: ReminderPerson, now: Date): 1 | 2 | null {
  if (!p.followUp || p.unsubscribed || p.booked) return null;
  const ageDays = (now.getTime() - Date.parse(p.latestAt)) / 86_400_000;
  const inWindow = (day: number) => ageDays >= day && ageDays < day + REMINDER_WINDOW_DAYS;
  if (!p.sent.includes(1) && inWindow(REMINDER_DAYS[0])) return 1;
  if (p.sent.includes(1) && !p.sent.includes(2) && inWindow(REMINDER_DAYS[1])) return 2;
  return null;
}

/* ------------------------------------------------------------------------ */
/* Unsubscribe links                                                         */
/* ------------------------------------------------------------------------ */

function secret(): string {
  return process.env.TOOL_LEAD_IP_SALT || process.env.NEXTAUTH_SECRET || '';
}

/** A signature over the lowercased email, so an unsubscribe link cannot be made for someone else. */
export function unsubscribeSignature(email: string, key = secret()): string {
  return createHmac('sha256', `unsubscribe:${key}`).update(email.trim().toLowerCase()).digest('base64url').slice(0, 32);
}

export function verifyUnsubscribe(email: string, signature: string, key = secret()): boolean {
  if (!key || !email || !signature) return false;
  const want = Buffer.from(unsubscribeSignature(email, key));
  const got = Buffer.from(signature);
  return want.length === got.length && timingSafeEqual(want, got);
}

export function unsubscribeHref(email: string, key = secret()): string {
  const e = Buffer.from(email.trim().toLowerCase()).toString('base64url');
  return `${SITE_HREF}/api/tools/unsubscribe?e=${e}&s=${unsubscribeSignature(email, key)}`;
}

export function emailFromParam(e: string | null): string | null {
  if (!e) return null;
  try {
    const v = Buffer.from(e, 'base64url').toString('utf8').trim().toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? v : null;
  } catch {
    return null;
  }
}
