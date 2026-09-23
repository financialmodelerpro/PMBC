import { NextResponse } from 'next/server';

import { auditGrowth, fail, ownerRequest } from '@/lib/growth/api';
import { createContact, getCompany } from '@/lib/growth/prospects';
import { blankToNull, contactCreateSchema } from '@/lib/growth/prospectsModel';

export const dynamic = 'force-dynamic';

/** Adds a contact to a company. An email already on file is refused as a duplicate. */
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const r = await ownerRequest(req, contactCreateSchema);
  if (!r.ok) return r.response;
  const { id } = await props.params;
  if (!(await getCompany(id))) return fail(404, 'Company not found');
  const result = await createContact(id, blankToNull(r.data), r.actor);
  if (!result.ok) return fail(result.status, result.error, result.code);
  await auditGrowth(r.adminId, 'create', 'growth_contacts', result.value.id, { company_id: id, full_name: result.value.full_name });
  return NextResponse.json({ contact: result.value });
}
