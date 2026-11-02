import { NextResponse } from 'next/server';

import { auditGrowth, fail, ownerRequest } from '@/lib/growth/api';
import { dismissSignals } from '@/lib/growth/signals';
import { signalBulkDismissSchema } from '@/lib/growth/signalsModel';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** Dismiss several signals at once, each with a reason. Only signals still new are dismissed. */
export async function POST(req: Request) {
  const r = await ownerRequest(req, signalBulkDismissSchema);
  if (!r.ok) return r.response;
  const result = await dismissSignals(r.data.items, r.actor);
  if (!result.dismissed.length && result.failed.length) return fail(500, result.failed[0].error);
  await auditGrowth(r.adminId, 'update', 'growth_signals', null, { action: 'bulk_dismiss', dismissed: result.dismissed, skipped: result.skipped, failed: result.failed.length });
  return NextResponse.json({ dismissed: result.dismissed.length, skipped: result.skipped, failed: result.failed });
}
