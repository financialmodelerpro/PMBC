/**
 * Server side of the short booking links: issuing a lead's link id, looking it
 * up, recording a click, and the link each channel should carry.
 *
 * A lead's link id is stored as one `booking_link` event on the lead, with the
 * id in its unique `dedupe_key`, so the lookup uses that column's index and no
 * new table is needed. See `src/lib/tools/bookingLinks.ts` for what a link can do.
 */

import { randomBytes } from 'node:crypto';

import { siteUrl } from '@/lib/seo/metadata';

import { BOOKING_LINK_EVENT, bookingLinkDedupeKey, bookingLinkPath, newBookingLinkId, type BookingChannel } from '../bookingLinks';
import type { BookingRedirectDeps } from '../bookingRedirect';
import { toolsDb, type ToolLeadRow } from '../db';
import { automatedMarker, classifyBookingClick } from '../engagement';
import { getLead, getLeadByToken, insertLeadEvent, resultsMessageTimeline, updateLead } from './store';

/** Creates the lead's link id. Null when it could not be stored; callers then use the long link. */
export async function issueBookingLink(leadId: string): Promise<string | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const id = newBookingLinkId((n) => randomBytes(n));
    const outcome = await insertLeadEvent({ lead_id: leadId, event_type: BOOKING_LINK_EVENT, source: 'system', dedupe_key: bookingLinkDedupeKey(id) });
    if (outcome === 'inserted') return id;
    if (outcome === 'failed') return null;
  }
  return null;
}

export async function leadIdForLink(id: string): Promise<string | null> {
  try {
    const { data } = await toolsDb().from('tool_lead_events').select('lead_id').eq('dedupe_key', bookingLinkDedupeKey(id)).eq('event_type', BOOKING_LINK_EVENT).maybeSingle();
    return (data as { lead_id?: string } | null)?.lead_id ?? null;
  } catch {
    return null;
  }
}

export async function linkIdForLead(leadId: string): Promise<string | null> {
  try {
    const { data } = await toolsDb()
      .from('tool_lead_events')
      .select('dedupe_key')
      .eq('lead_id', leadId)
      .eq('event_type', BOOKING_LINK_EVENT)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    const key = (data as { dedupe_key?: string } | null)?.dedupe_key ?? '';
    return key.startsWith(`${BOOKING_LINK_EVENT}:`) ? key.slice(BOOKING_LINK_EVENT.length + 1) : null;
  } catch {
    return null;
  }
}

/**
 * The absolute booking link for a lead and channel: the short link when the
 * lead has one, otherwise the long tracked link a lead saved before short links
 * existed has always used. Reads only.
 */
export async function bookingLinkFor(lead: Pick<ToolLeadRow, 'id' | 'access_token'>, channel: BookingChannel): Promise<string> {
  const id = await linkIdForLead(lead.id);
  if (id) return `${siteUrl()}${bookingLinkPath(id, channel)}`;
  return `${siteUrl()}/api/tools/book?t=${encodeURIComponent(lead.access_token)}&src=${channel}`;
}

/**
 * Records one booking click against the lead. A click from the results email on
 * arrival, or on an email that bounced, is likely a mail scanner: recorded with
 * the reason and not counted (`classifyBookingClick`).
 */
export async function recordBookingClick(lead: ToolLeadRow, src: BookingChannel, userAgent: string | null): Promise<void> {
  const now = new Date().toISOString();
  const timeline = src === 'email' ? await resultsMessageTimeline(lead.id, lead.email_message_id) : { deliveredAt: null, bounced: false };
  const automated = classifyBookingClick({
    src,
    clickedAt: now,
    deliveredAt: timeline.deliveredAt,
    sentAt: lead.email_sent_at,
    emailStatus: timeline.bounced ? 'bounced' : lead.email_status,
  });
  await Promise.all([
    insertLeadEvent({
      lead_id: lead.id,
      event_type: 'booking_click',
      source: src === 'results' ? 'results' : 'email',
      detail: src,
      payload: {
        user_agent: userAgent?.slice(0, 300) ?? null,
        ...(automated ? { pmbc_engagement: automatedMarker(automated, timeline.deliveredAt ?? lead.email_sent_at) } : {}),
      },
    }),
    automated ? Promise.resolve(true) : updateLead(lead.id, { booking_clicks: (lead.booking_clicks ?? 0) + 1, last_booking_click_at: now }),
  ]);
}

export const bookingRedirectDeps: BookingRedirectDeps<ToolLeadRow> = {
  leadIdForLink,
  leadById: async (id) => (await getLead(id)).lead,
  leadByToken: getLeadByToken,
  linkIdForLead,
  issueLink: issueBookingLink,
  recordClick: recordBookingClick,
};

/**
 * The name and email for prefilling the calendar on /book, from the lead
 * reference in the attribution cookie. Only these two fields leave the lead.
 */
export async function personForBookingRef(ref: string | undefined): Promise<{ name: string; email: string } | null> {
  if (!ref) return null;
  const leadId = await leadIdForLink(ref);
  const lead = leadId ? (await getLead(leadId)).lead : null;
  return lead ? { name: lead.name, email: lead.email } : null;
}
