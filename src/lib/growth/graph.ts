/**
 * Microsoft Graph for the Growth Engine (Unit 3.2, 2026-09-23; Bookings from
 * Unit 5.1). Server only.
 *
 * Mail is sent from Ahmad's mailbox (MS_GRAPH_SENDER) with an app registration
 * using client credentials: the app needs the Mail.Send and Mail.Read
 * application permissions (Bookings needs Bookings.Read.All), granted by an
 * admin, ideally limited to that one mailbox by an application access policy.
 *
 * Without all four variables the Growth Engine is in mock mode for mail:
 * nothing is delivered, sends are recorded as mock and labelled, and reply
 * detection is by hand. Plain `fetch`, no SDK. Values are never logged.
 */

export const GRAPH_MAIL_ENV = ['MS_GRAPH_TENANT_ID', 'MS_GRAPH_CLIENT_ID', 'MS_GRAPH_CLIENT_SECRET', 'MS_GRAPH_SENDER'] as const;
export const GRAPH_BOOKINGS_ENV = [...GRAPH_MAIL_ENV, 'MS_BOOKINGS_BUSINESS_ID'] as const;

type Env = Record<string, string | undefined>;

export function graphMailConfigured(env: Env = process.env): boolean {
  return GRAPH_MAIL_ENV.every((k) => Boolean(env[k]?.trim()));
}

export function graphBookingsConfigured(env: Env = process.env): boolean {
  return GRAPH_BOOKINGS_ENV.every((k) => Boolean(env[k]?.trim()));
}

export function graphSender(env: Env = process.env): string | null {
  return env.MS_GRAPH_SENDER?.trim().toLowerCase() || null;
}

let cached: { token: string; expires: number } | null = null;

async function accessToken(): Promise<string> {
  if (cached && cached.expires > Date.now() + 60_000) return cached.token;
  const tenant = process.env.MS_GRAPH_TENANT_ID as string;
  const body = new URLSearchParams({
    client_id: process.env.MS_GRAPH_CLIENT_ID as string,
    client_secret: process.env.MS_GRAPH_CLIENT_SECRET as string,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });
  const res = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`, { method: 'POST', body, cache: 'no-store' });
  const data = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string };
  if (!res.ok || !data.access_token) throw new Error(`Microsoft sign-in failed (${res.status}${data.error ? `: ${data.error}` : ''})`);
  cached = { token: data.access_token, expires: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return cached.token;
}

async function graph<T>(path: string, init: RequestInit = {}): Promise<{ status: number; data: T | null }> {
  const token = await accessToken();
  const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(init.headers ?? {}) },
    cache: 'no-store',
  });
  const text = await res.text();
  let data: T | null = null;
  try {
    data = text ? (JSON.parse(text) as T) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const msg = (data as { error?: { message?: string } } | null)?.error?.message ?? text.slice(0, 200);
    throw new Error(`Microsoft Graph ${res.status}: ${msg}`);
  }
  return { status: res.status, data };
}

export type GraphSendResult = { ok: true; messageId: string; conversationId: string | null } | { ok: false; error: string };

/**
 * Sends one email from the sender's mailbox. Created as a draft first so the
 * message and conversation ids are known, then sent; replies are later found
 * by conversation.
 */
export async function graphSendMail(input: { to: string; toName?: string | null; subject: string; html: string }): Promise<GraphSendResult> {
  const sender = graphSender();
  if (!graphMailConfigured() || !sender) return { ok: false, error: 'Microsoft Graph is not configured' };
  try {
    const draft = await graph<{ id: string; conversationId?: string }>(`/users/${encodeURIComponent(sender)}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        subject: input.subject,
        body: { contentType: 'HTML', content: input.html },
        toRecipients: [{ emailAddress: { address: input.to, ...(input.toName ? { name: input.toName } : {}) } }],
      }),
    });
    const id = draft.data?.id;
    if (!id) return { ok: false, error: 'Microsoft Graph did not return a message id' };
    await graph(`/users/${encodeURIComponent(sender)}/messages/${encodeURIComponent(id)}/send`, { method: 'POST' });
    return { ok: true, messageId: id, conversationId: draft.data?.conversationId ?? null };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message.slice(0, 300) : 'send failed' };
  }
}

export type GraphReply = { from: string; receivedAt: string; preview: string };

/** Messages in a conversation received after `since` from anyone but the sender. */
export async function graphRepliesInConversation(conversationId: string, since: string): Promise<{ ok: true; replies: GraphReply[] } | { ok: false; error: string }> {
  const sender = graphSender();
  if (!graphMailConfigured() || !sender) return { ok: false, error: 'Microsoft Graph is not configured' };
  try {
    const filter = encodeURIComponent(`conversationId eq '${conversationId.replace(/'/g, "''")}'`);
    const r = await graph<{ value: { from?: { emailAddress?: { address?: string } }; receivedDateTime: string; bodyPreview?: string }[] }>(
      `/users/${encodeURIComponent(sender)}/messages?$filter=${filter}&$select=from,receivedDateTime,bodyPreview&$top=50`,
    );
    const replies = (r.data?.value ?? [])
      .map((m) => ({ from: (m.from?.emailAddress?.address ?? '').toLowerCase(), receivedAt: m.receivedDateTime, preview: (m.bodyPreview ?? '').slice(0, 500) }))
      .filter((m) => m.from && m.from !== sender && Date.parse(m.receivedAt) > Date.parse(since));
    return { ok: true, replies };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message.slice(0, 300) : 'read failed' };
  }
}

export type BookingAppointment = {
  id: string;
  start: string;
  end: string;
  customerName: string | null;
  customerEmail: string | null;
  serviceName: string | null;
  joinUrl: string | null;
  cancelled: boolean;
  notes: string | null;
};

/** Microsoft Bookings appointments in a date range (Unit 5.1). */
export async function graphBookingAppointments(start: Date, end: Date): Promise<{ ok: true; appointments: BookingAppointment[] } | { ok: false; error: string }> {
  if (!graphBookingsConfigured()) return { ok: false, error: 'Microsoft Bookings is not configured' };
  const business = process.env.MS_BOOKINGS_BUSINESS_ID as string;
  try {
    type Raw = {
      id: string;
      startDateTime?: { dateTime: string; timeZone?: string };
      endDateTime?: { dateTime: string; timeZone?: string };
      customers?: { name?: string; emailAddress?: string }[];
      customerName?: string;
      customerEmailAddress?: string;
      serviceName?: string;
      joinWebUrl?: string;
      isCancelled?: boolean;
      customerNotes?: string;
    };
    const q = `start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`;
    const r = await graph<{ value: Raw[] }>(`/solutions/bookingBusinesses/${encodeURIComponent(business)}/calendarView?${q}`);
    const iso = (d?: { dateTime: string; timeZone?: string }) => (d?.dateTime ? new Date(/Z|[+-]\d\d:\d\d$/.test(d.dateTime) ? d.dateTime : `${d.dateTime}Z`).toISOString() : '');
    const appointments = (r.data?.value ?? []).map((a) => ({
      id: a.id,
      start: iso(a.startDateTime),
      end: iso(a.endDateTime),
      customerName: a.customers?.[0]?.name ?? a.customerName ?? null,
      customerEmail: (a.customers?.[0]?.emailAddress ?? a.customerEmailAddress ?? '').toLowerCase() || null,
      serviceName: a.serviceName ?? null,
      joinUrl: a.joinWebUrl ?? null,
      cancelled: Boolean(a.isCancelled),
      notes: a.customerNotes ?? null,
    }));
    return { ok: true, appointments };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message.slice(0, 300) : 'read failed' };
  }
}
