/**
 * Brevo transactional webhook handling for tool lead emails.
 *
 * AUTHENTICATION
 * A shared secret, `BREVO_WEBHOOK_TOKEN`, sent either as `?token=` in the
 * webhook URL (what the Brevo dashboard can do) or as `Authorization: Bearer`
 * (what the webhook API's `auth` object sends). Compared in constant time. With
 * the variable unset the endpoint refuses everything, so a deployment that has
 * not been configured cannot be written to by anyone.
 *
 * MATCHING
 * Every tool email is sent with `X-Mailin-custom: lead:<id>|kind:<results|alert>`,
 * which Brevo echoes on each event. That is tried first; the `message-id`
 * against the ids stored on the lead is the fallback. An event for no known
 * lead (a contact form email, a deleted lead) is acknowledged with 200 and
 * ignored, so Brevo does not retry it.
 *
 * STATUS
 * Only results-email events move `email_status`, by strength of evidence, so a
 * late `delivered` never overwrites `clicked`:
 *   complaint > bounced > blocked > clicked > opened > delivered > deferred > sent
 * Opens are recorded but are a weak signal (Apple Mail Privacy Protection and
 * image proxies open mail no person read); the admin view labels them so.
 * Clicks and booking clicks are the real signal.
 *
 * Pure apart from the injected `WebhookStore`, so `npm run verify-brevo-webhook`
 * exercises it without a database.
 */

import { timingSafeEqual } from 'node:crypto';

import type { EmailStatus } from './db';

export type NormalisedEvent = {
  /** Our vocabulary. Null for Brevo events we do not track. */
  type: 'delivered' | 'opened' | 'clicked' | 'bounced' | 'soft_bounced' | 'complaint' | 'blocked' | 'deferred' | 'unsubscribed' | 'error' | 'sent' | null;
  brevoEvent: string;
  email: string | null;
  messageId: string | null;
  leadId: string | null;
  kind: 'results' | 'alert' | null;
  link: string | null;
  reason: string | null;
  occurredAt: string;
  dedupeKey: string;
  raw: Record<string, unknown>;
};

const EVENT_MAP: Record<string, NormalisedEvent['type']> = {
  request: 'sent',
  sent: 'sent',
  delivered: 'delivered',
  opened: 'opened',
  unique_opened: 'opened',
  first_opening: 'opened',
  proxy_open: 'opened',
  unique_proxy_open: 'opened',
  click: 'clicked',
  clicked: 'clicked',
  hard_bounce: 'bounced',
  hardbounce: 'bounced',
  hard_bounced: 'bounced',
  invalid_email: 'bounced',
  soft_bounce: 'soft_bounced',
  softbounce: 'soft_bounced',
  soft_bounced: 'soft_bounced',
  spam: 'complaint',
  complaint: 'complaint',
  blocked: 'blocked',
  deferred: 'deferred',
  unsubscribed: 'unsubscribed',
  unsubscribe: 'unsubscribed',
  error: 'error',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function tokenMatches(provided: string | null | undefined, expected: string | null | undefined): boolean {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    // Still spend the comparison, so length is not learned from timing.
    timingSafeEqual(b, b);
    return false;
  }
  return timingSafeEqual(a, b);
}

export function extractToken(url: URL, authorization: string | null): string | null {
  const q = url.searchParams.get('token');
  if (q) return q;
  const m = authorization?.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : typeof v === 'number' ? String(v) : null;
}

export function parseCustomHeader(value: string | null): { leadId: string | null; kind: 'results' | 'alert' | null } {
  if (!value) return { leadId: null, kind: null };
  const parts = Object.fromEntries(
    value.split('|').map((p) => {
      const i = p.indexOf(':');
      return i === -1 ? [p.trim(), ''] : [p.slice(0, i).trim(), p.slice(i + 1).trim()];
    }),
  );
  const leadId = UUID_RE.test(parts.lead ?? '') ? parts.lead : null;
  const kind = parts.kind === 'results' || parts.kind === 'alert' ? parts.kind : null;
  return { leadId, kind };
}

export function normaliseEvent(raw: Record<string, unknown>): NormalisedEvent {
  const brevoEvent = (str(raw.event) ?? '').toLowerCase().replace(/\s+/g, '_');
  const custom = parseCustomHeader(str(raw['X-Mailin-custom']) ?? str(raw['x-mailin-custom']));
  const messageId = str(raw['message-id']) ?? str(raw.message_id) ?? str(raw.messageId);
  const epoch = typeof raw.ts_event === 'number' ? raw.ts_event : typeof raw.ts_epoch === 'number' ? raw.ts_epoch / 1000 : null;
  const occurredAt = epoch
    ? new Date(epoch * 1000).toISOString()
    : str(raw.date) && !Number.isNaN(Date.parse(str(raw.date) as string))
      ? new Date(str(raw.date) as string).toISOString()
      : new Date().toISOString();
  const link = str(raw.link);
  return {
    type: EVENT_MAP[brevoEvent] ?? null,
    brevoEvent,
    email: str(raw.email),
    messageId,
    leadId: custom.leadId,
    kind: custom.kind,
    link,
    reason: str(raw.reason),
    occurredAt,
    dedupeKey: `brevo:${messageId ?? 'none'}:${brevoEvent}:${str(raw.ts_event) ?? str(raw.ts_epoch) ?? str(raw.date) ?? ''}:${link ?? ''}`.slice(0, 500),
    raw,
  };
}

const RANK: Partial<Record<EmailStatus, number>> = {
  pending: 0,
  not_configured: 0,
  failed: 0,
  sent: 1,
  deferred: 2,
  delivered: 3,
  opened: 4,
  clicked: 5,
  blocked: 6,
  bounced: 7,
  complaint: 8,
};

const STATUS_FOR: Partial<Record<NonNullable<NormalisedEvent['type']>, EmailStatus>> = {
  sent: 'sent',
  deferred: 'deferred',
  delivered: 'delivered',
  opened: 'opened',
  clicked: 'clicked',
  blocked: 'blocked',
  bounced: 'bounced',
  soft_bounced: 'deferred',
  complaint: 'complaint',
  error: 'failed',
};

/** The status after this event, never weaker than the one before. */
export function nextEmailStatus(current: EmailStatus, event: NormalisedEvent['type']): EmailStatus {
  const candidate = event ? STATUS_FOR[event] : undefined;
  if (!candidate) return current;
  return (RANK[candidate] ?? 0) > (RANK[current] ?? 0) ? candidate : current;
}

/* ------------------------------------------------------------------------ */

export type WebhookLead = {
  id: string;
  email_status: EmailStatus;
  email_message_id: string | null;
  alert_message_id: string | null;
};

export type WebhookStore = {
  findLeadById(id: string): Promise<WebhookLead | null>;
  findLeadByMessageId(messageId: string): Promise<{ lead: WebhookLead; kind: 'results' | 'alert' } | null>;
  insertEvent(event: {
    lead_id: string;
    event_type: string;
    source: 'brevo';
    email_kind: 'results' | 'alert';
    message_id: string | null;
    link: string | null;
    detail: string | null;
    payload: Record<string, unknown>;
    occurred_at: string;
    dedupe_key: string;
  }): Promise<'inserted' | 'duplicate' | 'failed'>;
  updateLeadStatus(id: string, patch: { email_status: EmailStatus; email_last_event_at: string }): Promise<void>;
};

export type WebhookOutcome = {
  status: 200 | 400 | 401 | 503;
  body: Record<string, unknown>;
  recorded: number;
  duplicates: number;
  ignored: number;
};

export async function handleBrevoWebhook(
  input: { token: string | null; expectedToken: string | undefined; body: unknown },
  store: WebhookStore,
): Promise<WebhookOutcome> {
  const none = { recorded: 0, duplicates: 0, ignored: 0 };
  if (!input.expectedToken) return { status: 503, body: { error: 'Webhook not configured' }, ...none };
  if (!tokenMatches(input.token, input.expectedToken)) return { status: 401, body: { error: 'Unauthorized' }, ...none };

  const items = Array.isArray(input.body) ? input.body : [input.body];
  if (items.length === 0 || items.some((i) => !i || typeof i !== 'object' || Array.isArray(i))) {
    return { status: 400, body: { error: 'Expected an event object or an array of them' }, ...none };
  }

  let recorded = 0, duplicates = 0, ignored = 0;
  for (const item of items as Record<string, unknown>[]) {
    const ev = normaliseEvent(item);
    let lead: WebhookLead | null = null;
    let kind = ev.kind;
    if (ev.leadId) lead = await store.findLeadById(ev.leadId);
    if (!lead && ev.messageId) {
      const found = await store.findLeadByMessageId(ev.messageId);
      if (found) {
        lead = found.lead;
        kind = kind ?? found.kind;
      }
    }
    if (!lead || !ev.type) {
      ignored++;
      continue;
    }
    if (!kind) kind = ev.messageId && ev.messageId === lead.alert_message_id ? 'alert' : 'results';

    const result = await store.insertEvent({
      lead_id: lead.id,
      event_type: ev.type,
      source: 'brevo',
      email_kind: kind,
      message_id: ev.messageId,
      link: ev.link,
      detail: ev.reason ?? (ev.brevoEvent !== ev.type ? ev.brevoEvent : null),
      payload: ev.raw,
      occurred_at: ev.occurredAt,
      dedupe_key: ev.dedupeKey,
    });
    if (result === 'duplicate') {
      duplicates++;
      continue;
    }
    if (result === 'failed') {
      ignored++;
      continue;
    }
    recorded++;
    if (kind === 'results') {
      const next = nextEmailStatus(lead.email_status, ev.type);
      await store.updateLeadStatus(lead.id, { email_status: next, email_last_event_at: ev.occurredAt });
      lead.email_status = next;
    }
  }
  return { status: 200, body: { ok: true, recorded, duplicates, ignored }, recorded, duplicates, ignored };
}
