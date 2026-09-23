import { NextResponse } from 'next/server';

import { auditGrowth, fail, ownerRequest } from '@/lib/growth/api';
import { updateLead } from '@/lib/growth/prospects';
import { blankToNull, leadUpdateSchema } from '@/lib/growth/prospectsModel';

export const dynamic = 'force-dynamic';

/** Edits a lead. A stage change is dated and logged. */
export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const r = await ownerRequest(req, leadUpdateSchema);
  if (!r.ok) return r.response;
  const { id } = await props.params;
  const result = await updateLead(id, blankToNull(r.data), r.actor);
  if (!result.ok) return fail(result.status, result.error, result.code);
  await auditGrowth(r.adminId, 'update', 'growth_leads', id, r.data);
  return NextResponse.json({ lead: result.value });
}
