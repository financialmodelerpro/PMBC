/**
 * The "Book a free call" link for a tool's results.
 *
 * Calendly prefills its form from `name` and `email` query parameters and
 * records `utm_*` against the booking, so a call booked from a tool arrives
 * already attributed. The URL is `site_settings.booking_url`, the one setting
 * every booking surface reads. With it blank the link falls back to /book,
 * which then leads with the direct contact routes, and prefill is dropped
 * because /book has nothing to prefill.
 */

export type BookingLinkArgs = {
  bookingUrl: string | null | undefined;
  name?: string;
  email?: string;
  toolSlug: string;
  /** Where the click came from, recorded as utm_content: `results` or `email`. */
  placement: 'results' | 'email' | 'pdf';
};

export function bookingLink(args: BookingLinkArgs): string {
  const raw = (args.bookingUrl ?? '').trim();
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return '/book';
  }
  if (args.name) url.searchParams.set('name', args.name);
  if (args.email) url.searchParams.set('email', args.email);
  url.searchParams.set('utm_source', 'pacemakersglobal');
  url.searchParams.set('utm_medium', 'free-tool');
  url.searchParams.set('utm_campaign', args.toolSlug);
  url.searchParams.set('utm_content', args.placement);
  return url.toString();
}
