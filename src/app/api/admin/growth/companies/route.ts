import { NextResponse } from 'next/server';

import { auditGrowth, fail, ownerRequest } from '@/lib/growth/api';
import { createCompany } from '@/lib/growth/prospects';
import { blankToNull, companyCreateSchema } from '@/lib/growth/prospectsModel';

export const dynamic = 'force-dynamic';

/** Creates a prospect company by hand. A website domain already on file is refused as a duplicate. */
export async function POST(req: Request) {
  const r = await ownerRequest(req, companyCreateSchema);
  if (!r.ok) return r.response;
  const result = await createCompany(blankToNull(r.data), r.actor);
  if (!result.ok) return fail(result.status, result.error, result.code);
  await auditGrowth(r.adminId, 'create', 'growth_companies', result.value.id, { name: result.value.name });
  return NextResponse.json({ company: result.value });
}
