import { NextResponse } from 'next/server';

import { auditGrowth, fail, ownerRequest } from '@/lib/growth/api';
import { createLead, getCompany } from '@/lib/growth/prospects';
import { blankToNull, leadCreateSchema } from '@/lib/growth/prospectsModel';

export const dynamic = 'force-dynamic';

/** Opens a lead for a company. */
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const r = await ownerRequest(req, leadCreateSchema);
  if (!r.ok) return r.response;
  const { id } = await props.params;
  if (!(await getCompany(id))) return fail(404, 'Company not found');
  const result = await createLead(id, blankToNull(r.data), r.actor);
  if (!result.ok) return fail(result.status, result.error, result.code);
  await auditGrowth(r.adminId, 'create', 'growth_leads', result.value.id, { company_id: id, title: result.value.title });
  return NextResponse.json({ lead: result.value });
}
