import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auditGrowth, fail, ownerRequest } from '@/lib/growth/api';
import { createManualMeeting, syncBookings } from '@/lib/growth/meetings';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const schema = z.union([
  z.object({ action: z.literal('sync') }),
  z.object({
    action: z.literal('create'),
    lead_id: z.string().uuid().nullable().optional(),
    attendee_name: z.string().trim().max(200).nullable().optional(),
    attendee_email: z.string().trim().toLowerCase().email().nullable().optional().or(z.literal('')),
    starts_at: z.string().datetime({ offset: true }),
    ends_at: z.string().datetime({ offset: true }).nullable().optional(),
    join_url: z.string().trim().max(500).nullable().optional(),
  }),
]);

/** Syncs Microsoft Bookings (a labelled preview in mock mode), or adds a call by hand. */
export async function POST(req: Request) {
  const r = await ownerRequest(req, schema);
  if (!r.ok) return r.response;
  if (r.data.action === 'sync') {
    const res = await syncBookings({ actor: r.actor });
    if (!res.ok) return fail(res.status, res.error);
    await auditGrowth(r.adminId, 'update', 'growth_meetings', null, { sync: res.value.mode, created: res.value.created });
    return NextResponse.json(res.value);
  }
  const { action: _action, ...input } = r.data;
  if (!input.lead_id && !input.attendee_email && !input.attendee_name) return fail(422, 'Choose a lead or give the attendee');
  const res = await createManualMeeting({ ...input, attendee_email: input.attendee_email || null }, r.actor);
  if (!res.ok) return fail(res.status, res.error);
  await auditGrowth(r.adminId, 'create', 'growth_meetings', res.value.id, { starts_at: res.value.starts_at, lead_id: res.value.lead_id });
  return NextResponse.json({ meeting: res.value });
}
