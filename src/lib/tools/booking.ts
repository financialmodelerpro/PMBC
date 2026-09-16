/**
 * The "Book a free call" link for a tool's results.
 *
 * Always the site's own booking page, `/book`, never Calendly directly: the
 * visitor stays on pacemakersglobal.com, and /book embeds the calendar from
 * `site_settings.booking_url` (or shows the direct contact routes when that is
 * blank). The name, email and UTM tags travel as query parameters, and /book
 * passes them into the embedded calendar (`withBookingPrefill`), so the booking
 * form arrives prefilled and the booking is attributed.
 */

export type BookingLinkArgs = {
  name?: string;
  email?: string;
  toolSlug: string;
  /** Where the click came from, recorded as utm_content. */
  placement: 'results' | 'email' | 'pdf';
};

/** The query parameters /book accepts and forwards to the calendar. */
export const BOOKING_PREFILL_KEYS = ['name', 'email', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const;

/** A relative link to /book with prefill and attribution. */
export function bookingPageLink(args: BookingLinkArgs): string {
  const q = new URLSearchParams();
  if (args.name) q.set('name', args.name);
  if (args.email) q.set('email', args.email);
  q.set('utm_source', 'pacemakersglobal');
  q.set('utm_medium', 'free-tool');
  q.set('utm_campaign', args.toolSlug);
  q.set('utm_content', args.placement);
  return `/book?${q.toString()}`;
}

/**
 * The calendar URL with the prefill parameters from /book's own query string.
 * Only the known keys are copied, each capped in length, and only onto the
 * configured calendar URL, so the query string cannot point the embed anywhere
 * else. A blank or malformed calendar URL is returned unchanged.
 */
export function withBookingPrefill(
  calendarUrl: string,
  search: Record<string, string | string[] | undefined>,
): string {
  if (!calendarUrl) return calendarUrl;
  let url: URL;
  try {
    url = new URL(calendarUrl);
  } catch {
    return calendarUrl;
  }
  for (const key of BOOKING_PREFILL_KEYS) {
    const raw = search[key];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (typeof value === 'string' && value.trim()) url.searchParams.set(key, value.trim().slice(0, 200));
  }
  return url.toString();
}
