import { NextResponse } from 'next/server';

import { auditGrowth, fail, ownerRequest } from '@/lib/growth/api';
import { triageSignal } from '@/lib/growth/signals';
import { signalTriageSchema } from '@/lib/growth/signalsModel';

export const dynamic = 'force-dynamic';

/** Triage: convert, attach, dismiss (with a reason), reopen, or clear a duplicate flag. */
export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const r = await ownerRequest(req, signalTriageSchema);
  if (!r.ok) return r.response;
  const { id } = await props.params;
  const result = await triageSignal(id, r.data, r.actor);
  if (!result.ok) return fail(result.status, result.error, result.code);
  await auditGrowth(r.adminId, 'update', 'growth_signals', id, { action: r.data.action, status: result.value.status });
  return NextResponse.json({ signal: result.value });
}
