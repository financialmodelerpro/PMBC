import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auditGrowth, ownerRequest } from '@/lib/growth/api';
import { checkReplies, draftDueFollowUps, sendDue } from '@/lib/growth/outreach';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const schema = z.object({ job: z.enum(['replies', 'follow_ups', 'send_due']) });

/** Runs one of the daily outreach jobs now: check replies, draft due follow-ups, or send scheduled emails. */
export async function POST(req: Request) {
  const r = await ownerRequest(req, schema);
  if (!r.ok) return r.response;
  const message = r.data.job === 'replies' ? await checkReplies() : r.data.job === 'follow_ups' ? await draftDueFollowUps() : await sendDue();
  await auditGrowth(r.adminId, 'update', 'growth_messages', null, { job: r.data.job, result: message });
  return NextResponse.json({ message });
}
