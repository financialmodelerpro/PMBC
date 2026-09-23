import { NextResponse } from 'next/server';

import { auditGrowth, fail, ownerRequest } from '@/lib/growth/api';
import { updateContact } from '@/lib/growth/prospects';
import { blankToNull, contactUpdateSchema } from '@/lib/growth/prospectsModel';

export const dynamic = 'force-dynamic';

/** Edits a contact. A change of consent is dated. */
export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const r = await ownerRequest(req, contactUpdateSchema);
  if (!r.ok) return r.response;
  const { id } = await props.params;
  const result = await updateContact(id, blankToNull(r.data), r.actor);
  if (!result.ok) return fail(result.status, result.error, result.code);
  await auditGrowth(r.adminId, 'update', 'growth_contacts', id, r.data);
  return NextResponse.json({ contact: result.value });
}
