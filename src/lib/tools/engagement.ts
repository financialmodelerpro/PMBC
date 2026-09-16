/**
 * What counts as a visitor engaging with a tool email, and what does not.
 *
 * TWO THINGS NEVER COUNT
 * 1. The internal alert. It goes to the firm, so a click on it is staff
 *    opening the lead, not the visitor. Alert emails carry their own Brevo tag
 *    (`ALERT_TAG`) as well as `kind:alert` in the custom header, and an event
 *    that cannot be matched to either email is treated as the alert, the side
 *    that never counts.
 * 2. A click that is likely automated: within 60 seconds of the results email
 *    being delivered (mail security scanners follow links on arrival), or on a
 *    results email that bounced or was blocked (no person received it).
 *
 * Such events are kept in the lead's history with the reason, and the lead
 * detail shows the flag. They never move `email_status` and never add to
 * `booking_clicks`. Existing rows are not rewritten; the rules apply to events
 * received from the deploy that carries them.
 *
 * Pure, so `verify-brevo-webhook` proves every rule without a database.
 */

import type { EmailStatus } from './db';

/** Brevo tags. Results and alert emails no longer share a first tag. */
export const RESULTS_TAG = 'tool-lead';
export const ALERT_TAG = 'tool-lead-alert';

export const AUTOMATED_CLICK_WINDOW_MS = 60_000;

export type AutomatedReason = 'within_60s_of_delivery' | 'email_bounced';

export const AUTOMATED_REASON_TEXT: Record<AutomatedReason, string> = {
  within_60s_of_delivery: 'Likely automated: within 60 seconds of delivery',
  email_bounced: 'Likely automated: the email bounced or was blocked',
};

/** Statuses meaning no person received the results email. */
const UNDELIVERED: EmailStatus[] = ['bounced', 'blocked'];

/**
 * Which email an event belongs to. Evidence in order: the custom header, the
 * Brevo tags, the stored message ids, then the recipient. With none of those,
 * the alert, because an alert event can never count as engagement.
 */
export function resolveEmailKind(input: {
  headerKind: 'results' | 'alert' | null;
  tags: string[];
  messageId: string | null;
  resultsMessageId: string | null;
  alertMessageId: string | null;
  recipient: string | null;
  leadEmail: string | null;
}): 'results' | 'alert' {
  if (input.headerKind) return input.headerKind;
  const tags = input.tags.map((t) => t.toLowerCase());
  if (tags.includes(ALERT_TAG) || tags.includes('alert')) return 'alert';
  if (tags.includes('results')) return 'results';
  if (input.messageId && input.messageId === input.alertMessageId) return 'alert';
  if (input.messageId && input.messageId === input.resultsMessageId) return 'results';
  if (input.recipient && input.leadEmail && input.recipient.trim().toLowerCase() === input.leadEmail.trim().toLowerCase()) return 'results';
  return 'alert';
}

/**
 * Whether a click on the results email is likely automated, and why. The
 * delivery time is the `delivered` event for that message; without one yet,
 * the time the send was recorded. A click stamped slightly before delivery
 * (clocks differ) is inside the window too.
 */
export function classifyResultsClick(input: {
  clickedAt: string;
  deliveredAt: string | null;
  sentAt: string | null;
  bounced: boolean;
  emailStatus: EmailStatus | null;
}): AutomatedReason | null {
  if (input.bounced || (input.emailStatus !== null && UNDELIVERED.includes(input.emailStatus))) return 'email_bounced';
  const anchor = input.deliveredAt ?? input.sentAt;
  if (!anchor) return null;
  const gap = Date.parse(input.clickedAt) - Date.parse(anchor);
  if (!Number.isFinite(gap)) return null;
  return gap < AUTOMATED_CLICK_WINDOW_MS ? 'within_60s_of_delivery' : null;
}

/**
 * Whether a booking click (the tracked /api/tools/book redirect) is likely
 * automated. Only clicks from the results email are judged: the results page
 * and the PDF are opened by a person who already has the report. The results
 * email's own delivery time and status are the evidence.
 */
export function classifyBookingClick(input: {
  src: 'results' | 'email' | 'pdf';
  clickedAt: string;
  deliveredAt: string | null;
  sentAt: string | null;
  emailStatus: EmailStatus | null;
}): AutomatedReason | null {
  if (input.src !== 'email') return null;
  return classifyResultsClick({ clickedAt: input.clickedAt, deliveredAt: input.deliveredAt, sentAt: input.sentAt, bounced: false, emailStatus: input.emailStatus });
}

/** The marker stored in an event's payload. */
export type AutomatedMarker = { likely_automated: true; reason: AutomatedReason; anchor_at: string | null; window_seconds: number };

export function automatedMarker(reason: AutomatedReason, anchorAt: string | null): AutomatedMarker {
  return { likely_automated: true, reason, anchor_at: anchorAt, window_seconds: AUTOMATED_CLICK_WINDOW_MS / 1000 };
}

/** Reads the marker back from a stored event payload. */
export function automatedReasonOf(payload: unknown): AutomatedReason | null {
  const m = (payload as { pmbc_engagement?: Partial<AutomatedMarker> } | null)?.pmbc_engagement;
  return m?.likely_automated === true && (m.reason === 'within_60s_of_delivery' || m.reason === 'email_bounced') ? m.reason : null;
}
