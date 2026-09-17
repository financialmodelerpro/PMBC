/**
 * What a booking link click does, with its reads and writes injected, so
 * `verify-booking-links` can prove the rules without a database.
 *
 * Both entry points always send the visitor to `/book` with no query string.
 * The short link (`/b/<id><channel>`) and the older long link
 * (`/api/tools/book?t=<token>&src=<channel>`, still in emails and PDFs already
 * sent) record the click against the lead once and return the attribution to
 * store in the cookie. An unknown or malformed short id, or an unknown token,
 * records nothing and stores no lead reference.
 */

import { attributionForLink, parseBookingLinkSlug, type Attribution, type BookingChannel } from './bookingLinks';

export type ClickLead = { id: string; tool_slug: string | null };

export type BookingRedirectDeps<L extends ClickLead> = {
  /** The lead id a short link id belongs to, or null. */
  leadIdForLink(id: string): Promise<string | null>;
  leadById(id: string): Promise<L | null>;
  leadByToken(token: string): Promise<L | null>;
  /** The lead's short link id, when it has one, for the cookie's lead reference. */
  linkIdForLead(leadId: string): Promise<string | null>;
  /** Issues a short link id for a lead saved before short links existed, so its cookie can carry a reference. */
  issueLink(leadId: string): Promise<string | null>;
  recordClick(lead: L, channel: BookingChannel, userAgent: string | null): Promise<void>;
};

export type BookingRedirect = { location: '/book'; attribution: Attribution | null; recorded: boolean };

const NOTHING: BookingRedirect = { location: '/book', attribution: null, recorded: false };

export async function resolveShortLink<L extends ClickLead>(slug: string, userAgent: string | null, deps: BookingRedirectDeps<L>): Promise<BookingRedirect> {
  const parsed = parseBookingLinkSlug(slug);
  if (!parsed) return NOTHING;
  const leadId = await deps.leadIdForLink(parsed.id);
  const lead = leadId ? await deps.leadById(leadId) : null;
  if (!lead) return NOTHING;
  await deps.recordClick(lead, parsed.channel, userAgent);
  return { location: '/book', attribution: attributionForLink(lead.tool_slug ?? 'free-tools', parsed.channel, parsed.id), recorded: true };
}

const CHANNELS = new Set<BookingChannel>(['results', 'email', 'pdf']);

export async function resolveLegacyLink<L extends ClickLead>(token: string, src: string | null, userAgent: string | null, deps: BookingRedirectDeps<L>): Promise<BookingRedirect> {
  const channel = (CHANNELS.has(src as BookingChannel) ? src : 'results') as BookingChannel;
  const lead = token ? await deps.leadByToken(token) : null;
  if (!lead) return NOTHING;
  await deps.recordClick(lead, channel, userAgent);
  const linkId = (await deps.linkIdForLead(lead.id)) ?? (await deps.issueLink(lead.id));
  return { location: '/book', attribution: attributionForLink(lead.tool_slug ?? 'free-tools', channel, linkId), recorded: true };
}
