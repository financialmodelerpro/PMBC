/**
 * The one booking link rule for the Growth Engine (2026-09-23).
 *
 * The site's own /book page is the permanent default. The "Microsoft Bookings
 * link" setting (bookings_url, migration 091) is empty by default; empty means
 * /book. A direct link, when Ahmad enters one, overrides /book everywhere a
 * booking is offered: the website chat, no-show rebooking emails, meeting
 * recaps and outreach drafts. Every draft that offers a call writes the
 * placeholder [Booking link], which is replaced with this link when the draft
 * is made, so no path builds its own.
 *
 * `resolveBookingUrl` is pure (the verifier tests it); `growthBookingUrl`
 * reads the setting. Nothing else in the Growth code may build a booking URL.
 */

import { SITE_HREF } from '@/lib/brand/letterhead';

import { getEngineSettings } from './engineSettings';

export const DEFAULT_BOOKING_PATH = '/book';
export const BOOKING_PLACEHOLDER = '[Booking link]';

/** The booking link: the direct link when one is set, otherwise the site's /book page. */
export function resolveBookingUrl(setting: string | null | undefined): string {
  const v = (setting ?? '').trim();
  return v || `${SITE_HREF}${DEFAULT_BOOKING_PATH}`;
}

/** The booking link from Growth Settings. Before migration 091, or if the row cannot be read, /book. */
export async function growthBookingUrl(): Promise<string> {
  try {
    const engine = await getEngineSettings();
    return resolveBookingUrl(engine.missing.includes('bookings_url') ? '' : engine.values.bookings_url);
  } catch {
    return resolveBookingUrl('');
  }
}

/** Replaces the booking placeholder in a draft with the link. */
export function fillBookingLink(text: string, url: string): string {
  return text.split(BOOKING_PLACEHOLDER).join(url);
}
