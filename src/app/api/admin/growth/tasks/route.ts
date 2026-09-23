import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auditGrowth, fail, ownerRequest } from '@/lib/growth/api';
import { createTask, taskSchema } from '@/lib/growth/pipeline';

export const dynamic = 'force-dynamic';

const schema = taskSchema.extend({ lead_id: z.string().uuid().nullable().optional(), company_id: z.string().uuid().nullable().optional() });

/** Adds a task with an optional due date to a lead or company. */
export async function POST(req: Request) {
  const r = await ownerRequest(req, schema);
  if (!r.ok) return r.response;
  const result = await createTask({ leadId: r.data.lead_id, companyId: r.data.company_id, title: r.data.title, due_date: r.data.due_date, notes: r.data.notes }, r.actor);
  if (!result.ok) return fail(result.status, result.error);
  await auditGrowth(r.adminId, 'create', 'growth_tasks', result.value.id, { title: result.value.title, due_date: result.value.due_date });
  return NextResponse.json({ task: result.value });
}
