import { NextResponse } from 'next/server';

import { auditGrowth, fail, ownerRequest } from '@/lib/growth/api';
import { draftOutreach } from '@/lib/growth/outreach';
import { draftRequestSchema } from '@/lib/growth/outreachModel';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** Drafts a first email or LinkedIn message for a lead. Nothing is sent. */
export async function POST(req: Request) {
  const r = await ownerRequest(req, draftRequestSchema);
  if (!r.ok) return r.response;
  const result = await draftOutreach(r.data.lead_id, r.data.channel, r.actor);
  if (!result.ok) return fail(result.status, result.error, result.code);
  await auditGrowth(r.adminId, 'create', 'growth_messages', result.value.id, { lead_id: r.data.lead_id, channel: r.data.channel, mock_ai: result.value.is_mock_ai });
  return NextResponse.json({ message: result.value });
}
