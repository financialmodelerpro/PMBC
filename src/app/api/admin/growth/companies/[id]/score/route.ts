import { NextResponse } from 'next/server';

import { auditGrowth, fail, ownerRequest } from '@/lib/growth/api';
import { rescoreCompany, setScoreOverride } from '@/lib/growth/prospects';
import { scoreOverrideSchema } from '@/lib/growth/prospectsModel';

export const dynamic = 'force-dynamic';

/** Sets a manual score (a reason is required) or clears it. */
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const r = await ownerRequest(req, scoreOverrideSchema);
  if (!r.ok) return r.response;
  const { id } = await props.params;
  const result = await setScoreOverride(id, r.data, r.actor);
  if (!result.ok) return fail(result.status, result.error, result.code);
  await auditGrowth(r.adminId, 'update', 'growth_companies', id, { score_override: r.data });
  return NextResponse.json({ company: result.value });
}

/** Rescores now, from the current rules and weights. */
export async function PUT(req: Request, props: { params: Promise<{ id: string }> }) {
  const r = await ownerRequest(req);
  if (!r.ok) return r.response;
  const { id } = await props.params;
  const result = await rescoreCompany(id, { actor: r.actor });
  if (!result) return fail(404, 'Company not found');
  return NextResponse.json({ score: result });
}
