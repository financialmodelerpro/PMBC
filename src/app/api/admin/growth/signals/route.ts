import { NextResponse } from 'next/server';

import { auditGrowth, fail, ownerRequest } from '@/lib/growth/api';
import { createSignal } from '@/lib/growth/signals';
import { signalCreateSchema } from '@/lib/growth/signalsModel';

export const dynamic = 'force-dynamic';

/** Adds a signal by hand. The evidence link is required; a likely duplicate is flagged, not refused. */
export async function POST(req: Request) {
  const r = await ownerRequest(req, signalCreateSchema);
  if (!r.ok) return r.response;
  const result = await createSignal(r.data, r.actor, { origin: 'manual' });
  if (!result.ok) return fail(result.status, result.error, result.code);
  await auditGrowth(r.adminId, 'create', 'growth_signals', result.value.id, { trigger_type: result.value.trigger_type, evidence_url: result.value.evidence_url });
  return NextResponse.json({ signal: result.value });
}
