import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

import { ATTRIBUTION_COOKIE, decodeAttribution } from '@/lib/tools/bookingLinks';
import { leadIdForLink } from '@/lib/tools/leads/bookingLinkStore';
import { BOOKED_EVENT } from '@/lib/tools/leads/reminders';
import { insertLeadEvent } from '@/lib/tools/leads/store';

export const dynamic = 'force-dynamic';

/**
 * A meeting scheduled on /book (since 2026-09-21). The embedded Calendly widget tells the page when a
 * booking is made (`calendly.event_scheduled`); the page reports it here, and the lead the visitor came
 * from, read from the first-party booking cookie, gets a `booking_scheduled` event, which stops the
 * follow-up reminders. A visitor without the cookie (not from a tool) records nothing. One event per
 * scheduled meeting, keyed on Calendly's event URI.
 */
export async function POST(req: Request) {
  let body: { eventUri?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    // An empty body still records the booking, keyed on the day.
  }
  const attribution = decodeAttribution((await cookies()).get(ATTRIBUTION_COOKIE)?.value);
  const ref = attribution?.ref;
  const leadId = ref ? await leadIdForLink(ref) : null;
  if (!leadId) return new NextResponse(null, { status: 204 });
  const uri = typeof body.eventUri === 'string' && body.eventUri.startsWith('https://') ? body.eventUri.slice(0, 300) : new Date().toISOString().slice(0, 10);
  const key = createHash('sha256').update(uri).digest('hex').slice(0, 24);
  await insertLeadEvent({ lead_id: leadId, event_type: BOOKED_EVENT, source: 'results', dedupe_key: `${BOOKED_EVENT}:${leadId}:${key}`, detail: 'Meeting scheduled on /book.' });
  return new NextResponse(null, { status: 204 });
}
