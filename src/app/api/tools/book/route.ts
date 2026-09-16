import { NextResponse } from 'next/server';

import { bookingPageLink } from '@/lib/tools/booking';
import { automatedMarker, classifyBookingClick } from '@/lib/tools/engagement';
import { getLeadByToken, insertLeadEvent, resultsMessageTimeline, updateLead } from '@/lib/tools/leads/store';

export const dynamic = 'force-dynamic';

const SOURCES = new Set(['results', 'email', 'pdf']);

/**
 * "Book a free call", tracked.
 *
 * The results screen, the results email and the PDF link here with the lead's
 * access token and where the click came from. The click is recorded against the
 * lead, then the visitor is sent to the site's own /book page with their name,
 * email and UTM tags, which /book passes into the embedded calendar.
 *
 * Never an open redirect: the destination is always /book on this site,
 * whatever the query says. An unknown or missing token still
 * redirects, without prefill, so a stale link is never a dead end.
 *
 * Email security scanners sometimes open links before a person does, so a click
 * from `email` is a signal to check against the event's user agent, not proof.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get('t') ?? '';
  const srcParam = url.searchParams.get('src') ?? 'results';
  const src = (SOURCES.has(srcParam) ? srcParam : 'results') as 'results' | 'email' | 'pdf';

  const lead = await getLeadByToken(token);

  if (lead) {
    const now = new Date().toISOString();
    // A click from the results email on arrival, or on one that bounced, is
    // likely a scanner: recorded with the reason, not counted.
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
          user_agent: req.headers.get('user-agent')?.slice(0, 300) ?? null,
          ...(automated ? { pmbc_engagement: automatedMarker(automated, timeline.deliveredAt ?? lead.email_sent_at) } : {}),
        },
      }),
      automated ? Promise.resolve(true) : updateLead(lead.id, { booking_clicks: (lead.booking_clicks ?? 0) + 1, last_booking_click_at: now }),
    ]);
  }

  const destination = bookingPageLink({
    name: lead?.name,
    email: lead?.email,
    toolSlug: lead?.tool_slug ?? 'free-tools',
    placement: src,
  });
  return NextResponse.redirect(new URL(destination, url.origin), 302);
}
