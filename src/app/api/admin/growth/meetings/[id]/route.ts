import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auditGrowth, fail, ownerRequest } from '@/lib/growth/api';
import { draftMeetingEmail, generateBrief, recordOutcome } from '@/lib/growth/meetings';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('brief') }),
  z.object({
    action: z.literal('outcome'),
    status: z.enum(['completed', 'no_show', 'cancelled']),
    notes: z.string().trim().max(8000).nullable().optional(),
    outcome: z.enum(['positive', 'proposal_requested', 'needs_follow_up', 'not_a_fit', 'other']).nullable().optional(),
    lost_reason: z.string().trim().max(500).nullable().optional(),
  }),
  z.object({ action: z.literal('draft'), kind: z.enum(['recap', 'no_show']) }),
]);

/** Prepares the brief, records the outcome and notes, or drafts a recap or no-show email for approval. */
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const r = await ownerRequest(req, schema);
  if (!r.ok) return r.response;
  const { id } = await props.params;
  if (r.data.action === 'brief') {
    const res = await generateBrief(id, { actor: r.actor });
    if (!res.ok) return fail(res.status, res.error, res.code);
    await auditGrowth(r.adminId, 'update', 'growth_meetings', id, { brief: true, mock: res.value.brief_is_mock });
    return NextResponse.json({ meeting: res.value });
  }
  if (r.data.action === 'outcome') {
    const { action: _a, ...input } = r.data;
    const res = await recordOutcome(id, input, r.actor);
    if (!res.ok) return fail(res.status, res.error);
    await auditGrowth(r.adminId, 'update', 'growth_meetings', id, { status: res.value.status, outcome: res.value.outcome });
    return NextResponse.json({ meeting: res.value });
  }
  const res = await draftMeetingEmail(id, r.data.kind, r.actor);
  if (!res.ok) return fail(res.status, res.error, res.code);
  await auditGrowth(r.adminId, 'create', 'growth_messages', res.value.id, { meeting_id: id, kind: r.data.kind });
  return NextResponse.json({ message: res.value });
}
