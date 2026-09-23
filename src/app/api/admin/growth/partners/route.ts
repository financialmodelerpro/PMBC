import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auditGrowth, fail, ownerRequest } from '@/lib/growth/api';
import { partnerSchema, savePartner } from '@/lib/growth/partners';

export const dynamic = 'force-dynamic';

const schema = partnerSchema.extend({ id: z.string().uuid().nullable().optional() });

/** Adds a partner or past client, or updates one (pass its id). */
export async function POST(req: Request) {
  const r = await ownerRequest(req, schema);
  if (!r.ok) return r.response;
  const { id, ...input } = r.data;
  const res = await savePartner(id ?? null, input, r.actor);
  if (!res.ok) return fail(res.status, res.error);
  await auditGrowth(r.adminId, id ? 'update' : 'create', 'growth_partners', res.value.id, { name: res.value.name, type: res.value.type });
  return NextResponse.json({ partner: res.value });
}
