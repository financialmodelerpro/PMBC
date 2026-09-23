import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auditGrowth, fail, ownerRequest } from '@/lib/growth/api';
import { linkAllEligible, linkToolLead } from '@/lib/growth/valuationLink';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const schema = z.union([z.object({ id: z.string().uuid() }), z.object({ all: z.literal(true) })]);

/** Links one valuation tool lead (or every eligible one) to a Growth lead. The tool's tables are only read. */
export async function POST(req: Request) {
  const r = await ownerRequest(req, schema);
  if (!r.ok) return r.response;
  if ('all' in r.data) {
    const res = await linkAllEligible(r.actor);
    await auditGrowth(r.adminId, 'create', 'growth_leads', null, { linked_from_tool: res.linked });
    return NextResponse.json(res);
  }
  const res = await linkToolLead(r.data.id, r.actor);
  if (!res.ok) return fail(res.status, res.error, res.code);
  await auditGrowth(r.adminId, 'create', 'growth_leads', res.value.leadId, { tool_lead_id: r.data.id });
  return NextResponse.json(res.value);
}
