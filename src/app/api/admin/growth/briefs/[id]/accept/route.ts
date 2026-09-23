import { NextResponse } from 'next/server';

import { acceptBrief } from '@/lib/growth/agents/research';
import { acceptSchema } from '@/lib/growth/agents/researchModel';
import { auditGrowth, fail, ownerRequest } from '@/lib/growth/api';

export const dynamic = 'force-dynamic';

/** Accepts chosen fields of a research brief into the company profile. Mock briefs are refused. */
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const r = await ownerRequest(req, acceptSchema);
  if (!r.ok) return r.response;
  const { id } = await props.params;
  const result = await acceptBrief(id, r.data.fields, r.actor);
  if (!result.ok) return fail(result.status, result.error, result.code);
  await auditGrowth(r.adminId, 'update', 'growth_research_briefs', id, { accepted: r.data.fields, applied: result.value.applied });
  return NextResponse.json(result.value);
}
