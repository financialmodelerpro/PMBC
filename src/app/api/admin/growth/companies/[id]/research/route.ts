import { NextResponse } from 'next/server';

import { runResearch } from '@/lib/growth/agents/research';
import { auditGrowth, fail, ownerRequest } from '@/lib/growth/api';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Runs the Research Agent for one company. The brief is kept; nothing reaches the profile until accepted. */
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const r = await ownerRequest(req);
  if (!r.ok) return r.response;
  const { id } = await props.params;
  const result = await runResearch(id, r.actor);
  if (!result.ok) return fail(result.status, result.error, result.code);
  await auditGrowth(r.adminId, 'create', 'growth_research_briefs', result.value.brief.id, { company_id: id, mock: result.value.mock });
  return NextResponse.json(result.value);
}
