/**
 * Short booking links and booking attribution.
 *
 * A tool's "Book a free call" links (results page, results email, PDF and its
 * QR code) are short: `/b/<id><channel>`, for example `/b/Fq7mKx2RtWp9e`.
 *
 *   id       12 characters from a 56 character alphabet without look-alikes
 *            (about 70 bits), random per lead, stored against the lead as a
 *            `booking_link` event whose unique `dedupe_key` is the lookup.
 *   channel  one letter: r results page, e email, p PDF.
 *
 * WHAT A SHORT LINK CAN DO. Open the booking page, record the click against the
 * lead with its channel, and set the attribution cookie. Nothing else: it is not
 * the lead's access token, it is never accepted where the access token is (lead
 * versions, the PDF download, the lead API), and an unknown or malformed id
 * redirects to /book without recording anything or reading the database twice.
 *
 * ATTRIBUTION. The redirect stores source, medium, campaign, content and the
 * link id (the lead reference) in a first-party cookie, `pmbc_booking`, then
 * sends the visitor to /book with no query string. /book reads the cookie to
 * prefill and attribute the embedded calendar (utm_* on the calendar URL, the
 * link id as utm_term), and when /book is reached with tracking parameters from
 * anywhere else it stores them the same way and clears them from the address
 * bar without reloading (`BookingUrlCleaner`). No name, email or token is ever
 * stored in the cookie.
 *
 * Pure and dependency free: the routes, the page and the verifier share it.
 */

export const BOOKING_LINK_ID_LENGTH = 12;
export const BOOKING_LINK_ALPHABET = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const BOOKING_CHANNEL_CODES = { results: 'r', email: 'e', pdf: 'p' } as const;
export type BookingChannel = keyof typeof BOOKING_CHANNEL_CODES;

export const BOOKING_LINK_EVENT = 'booking_link';
export const bookingLinkDedupeKey = (id: string) => `${BOOKING_LINK_EVENT}:${id}`;

/**
 * A new random id. `randomBytes` is `crypto.getRandomValues` or node's
 * `randomBytes`; bytes at or above the largest multiple of the alphabet size are
 * discarded, so every character is equally likely.
 */
export function newBookingLinkId(randomBytes: (n: number) => Uint8Array): string {
  const size = BOOKING_LINK_ALPHABET.length;
  const limit = 256 - (256 % size);
  let out = '';
  while (out.length < BOOKING_LINK_ID_LENGTH) {
    for (const b of randomBytes(BOOKING_LINK_ID_LENGTH * 2)) {
      if (b < limit) out += BOOKING_LINK_ALPHABET[b % size];
      if (out.length === BOOKING_LINK_ID_LENGTH) break;
    }
  }
  return out;
}

export function isBookingLinkId(id: string): boolean {
  if (id.length !== BOOKING_LINK_ID_LENGTH) return false;
  for (const ch of id) if (!BOOKING_LINK_ALPHABET.includes(ch)) return false;
  return true;
}

/** The site-relative short link for a channel. */
export function bookingLinkPath(id: string, channel: BookingChannel): string {
  return `/b/${id}${BOOKING_CHANNEL_CODES[channel]}`;
}

/** The id and channel from the `/b/` path segment, or null when it is not a well-formed short link. */
export function parseBookingLinkSlug(slug: string): { id: string; channel: BookingChannel } | null {
  if (typeof slug !== 'string' || slug.length !== BOOKING_LINK_ID_LENGTH + 1) return null;
  const id = slug.slice(0, BOOKING_LINK_ID_LENGTH);
  const code = slug.slice(BOOKING_LINK_ID_LENGTH);
  const channel = (Object.keys(BOOKING_CHANNEL_CODES) as BookingChannel[]).find((k) => BOOKING_CHANNEL_CODES[k] === code);
  if (!channel || !isBookingLinkId(id)) return null;
  return { id, channel };
}

/* ------------------------------------------------------------------------ */
/* Attribution                                                               */
/* ------------------------------------------------------------------------ */

export const ATTRIBUTION_COOKIE = 'pmbc_booking';
/** Thirty days: long enough for a visitor to come back to the calendar later. */
export const ATTRIBUTION_MAX_AGE = 30 * 24 * 60 * 60;

export type Attribution = {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
  /** The booking link id: the lead reference. Only opens the booking page. */
  ref?: string;
};

const FIELDS: [keyof Attribution, string][] = [
  ['source', 'utm_source'],
  ['medium', 'utm_medium'],
  ['campaign', 'utm_campaign'],
  ['content', 'utm_content'],
  ['term', 'utm_term'],
  ['ref', 'ref'],
];

/** Query parameters that mark a tracked arrival and are cleared from the /book address bar. */
export const TRACKING_QUERY_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'ref', 'name', 'email', 'gclid', 'fbclid', 'msclkid', 'mc_cid', 'mc_eid'] as const;

const clean = (v: unknown, max = 100): string | undefined => {
  const s = typeof v === 'string' ? v.trim().slice(0, max) : '';
  return s && /^[\w .@+\-:/]+$/.test(s) ? s : undefined;
};

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** The attribution for a tool's short link. */
export function attributionForLink(toolSlug: string, channel: BookingChannel, id: string | null): Attribution {
  return { source: 'pacemakersglobal', medium: 'free-tool', campaign: toolSlug, content: channel, ...(id ? { ref: id } : {}) };
}

/** Attribution from a query string, or null when it carries none. The ref is kept only when well formed. */
export function attributionFromSearch(search: Record<string, string | string[] | undefined>): Attribution | null {
  const a: Attribution = {};
  for (const [field, key] of FIELDS) {
    const v = clean(first(search[key]));
    if (v && (field !== 'ref' || isBookingLinkId(v))) a[field] = v;
  }
  return Object.keys(a).length ? a : null;
}

export function hasTrackingQuery(search: Record<string, string | string[] | undefined>): boolean {
  return TRACKING_QUERY_KEYS.some((k) => first(search[k]) !== undefined);
}

export function encodeAttribution(a: Attribution): string {
  const q = new URLSearchParams();
  for (const [field, key] of FIELDS) if (a[field]) q.set(key, a[field] as string);
  return q.toString();
}

export function decodeAttribution(raw: string | undefined | null): Attribution | null {
  if (!raw) return null;
  try {
    const q = new URLSearchParams(decodeURIComponent(raw));
    return attributionFromSearch(Object.fromEntries(q.entries()));
  } catch {
    return null;
  }
}

/** The Set-Cookie value. Readable by the page (it holds no secret), first-party, SameSite Lax. */
export function attributionCookie(a: Attribution, secure: boolean): string {
  return `${ATTRIBUTION_COOKIE}=${encodeURIComponent(encodeAttribution(a))}; Path=/; Max-Age=${ATTRIBUTION_MAX_AGE}; SameSite=Lax${secure ? '; Secure' : ''}`;
}

/**
 * The prefill and attribution keys for the booking calendar: utm tags from the
 * attribution, the lead reference as utm_term when no term was given, and the
 * name and email when the page knows them.
 */
export function calendarParams(a: Attribution | null, person?: { name?: string | null; email?: string | null } | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (person?.name) out.name = person.name;
  if (person?.email) out.email = person.email;
  if (!a) return out;
  if (a.source) out.utm_source = a.source;
  if (a.medium) out.utm_medium = a.medium;
  if (a.campaign) out.utm_campaign = a.campaign;
  if (a.content) out.utm_content = a.content;
  const term = a.term ?? (a.ref ? `ref-${a.ref}` : undefined);
  if (term) out.utm_term = term;
  return out;
}
