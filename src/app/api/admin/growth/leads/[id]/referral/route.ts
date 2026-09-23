import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auditGrowth, fail, ownerRequest } from '@/lib/growth/api';
import { setReferral } from '@/lib/growth/partners';

export const dynamic = 'force-dynamic';

const schema = z.object({ partner_id: z.string().uuid().nullable(), source: z.string().trim().max(300).nullable() });

/** Sets the referral partner and referral source on a lead. */
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const r = await ownerRequest(req, schema);
  if (!r.ok) return r.response;
  const { id } = await props.params;
  const res = await setReferral(id, r.data.partner_id, r.data.source, r.actor);
  if (!res.ok) return fail(res.status, res.error);
  await auditGrowth(r.adminId, 'update', 'growth_leads', id, r.data);
  return NextResponse.json({ ok: true });
}
