import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auditGrowth, fail, ownerRequest } from '@/lib/growth/api';
import { opportunitySchema, saveOpportunity } from '@/lib/growth/pipeline';

export const dynamic = 'force-dynamic';

const schema = opportunitySchema.extend({ id: z.string().uuid().optional() });

/** Opens an opportunity on a lead, or updates one (pass its id). Lost needs a reason. */
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const r = await ownerRequest(req, schema);
  if (!r.ok) return r.response;
  const { id } = await props.params;
  const { id: oppId, ...input } = r.data;
  const result = await saveOpportunity(id, oppId ?? null, input, r.actor);
  if (!result.ok) return fail(result.status, result.error);
  await auditGrowth(r.adminId, oppId ? 'update' : 'create', 'growth_opportunities', result.value.id, input);
  return NextResponse.json({ opportunity: result.value });
}
