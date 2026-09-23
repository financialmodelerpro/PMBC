import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auditGrowth, fail, ownerRequest } from '@/lib/growth/api';
import { decideReview, runReview } from '@/lib/growth/scoringReview';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('run'), kind: z.enum(['prospect', 'lead']) }),
  z.object({ action: z.literal('decide'), id: z.string().uuid(), decision: z.enum(['approve', 'reject']), note: z.string().trim().max(1000).nullable().optional() }),
]);

/** Runs a scoring review against real outcomes, or approves or rejects its suggested weights. */
export async function POST(req: Request) {
  const r = await ownerRequest(req, schema);
  if (!r.ok) return r.response;
  if (r.data.action === 'run') {
    const res = await runReview(r.data.kind, r.actor);
    if (!res.ok) return fail(res.status, res.error);
    return NextResponse.json(res.value);
  }
  const res = await decideReview(r.data.id, r.data.decision, r.data.note ?? null, r.actor);
  if (!res.ok) return fail(res.status, res.error);
  await auditGrowth(r.adminId, 'update', 'growth_scoring_reviews', r.data.id, { decision: r.data.decision, weights: res.value.suggested_weights });
  return NextResponse.json({ review: res.value });
}
