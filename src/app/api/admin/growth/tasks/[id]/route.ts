import { NextResponse } from 'next/server';

import { auditGrowth, fail, ownerRequest } from '@/lib/growth/api';
import { taskUpdateSchema, updateTask } from '@/lib/growth/pipeline';

export const dynamic = 'force-dynamic';

/** Marks a task done or reopens it, or changes its title or due date. */
export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const r = await ownerRequest(req, taskUpdateSchema);
  if (!r.ok) return r.response;
  const { id } = await props.params;
  const result = await updateTask(id, r.data, r.actor);
  if (!result.ok) return fail(result.status, result.error);
  await auditGrowth(r.adminId, 'update', 'growth_tasks', id, r.data);
  return NextResponse.json({ task: result.value });
}
