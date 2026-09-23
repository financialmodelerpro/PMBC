import { NextResponse } from 'next/server';

import { auditGrowth, fail, ownerRequest } from '@/lib/growth/api';
import { getCompany, updateCompany } from '@/lib/growth/prospects';
import { blankToNull, companyUpdateSchema } from '@/lib/growth/prospectsModel';

export const dynamic = 'force-dynamic';

/** Edits a company's profile. Every changed field is logged and the company is rescored. */
export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const r = await ownerRequest(req, companyUpdateSchema);
  if (!r.ok) return r.response;
  const { id } = await props.params;
  const before = await getCompany(id);
  const result = await updateCompany(id, blankToNull(r.data), r.actor);
  if (!result.ok) return fail(result.status, result.error, result.code);
  await auditGrowth(r.adminId, 'update', 'growth_companies', id, r.data, before ? { name: before.name } : null);
  return NextResponse.json({ company: result.value });
}
