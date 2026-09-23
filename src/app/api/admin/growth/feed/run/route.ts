import { NextResponse } from 'next/server';

import { auditGrowth, fail, ownerRequest } from '@/lib/growth/api';
import { runSignalFeed } from '@/lib/growth/feed';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Runs the signal feed now. In mock mode it is a labelled preview and saves nothing. */
export async function POST(req: Request) {
  const r = await ownerRequest(req);
  if (!r.ok) return r.response;
  const result = await runSignalFeed({ trigger: 'manual', actor: r.actor });
  if (!result.ok) return fail(result.status, result.error);
  await auditGrowth(r.adminId, 'create', 'growth_feed_runs', result.value.runId, { mode: result.value.mode, saved: result.value.saved });
  return NextResponse.json(result.value);
}
