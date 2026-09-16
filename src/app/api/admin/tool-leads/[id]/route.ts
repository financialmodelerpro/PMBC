import { NextResponse } from 'next/server';
import { z } from 'zod';

import { writeAudit } from '@/lib/audit';
import { getAdminSession } from '@/lib/auth/requireAdmin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getLead, updateLead } from '@/lib/tools/leads/store';

export const dynamic = 'force-dynamic';

const bodySchema = z
  .object({
    status: z.enum(['new', 'read', 'responded', 'archived']).optional(),
    notes: z.string().max(10000).nullable().optional(),
  })
  .refine((b) => b.status !== undefined || b.notes !== undefined, { message: 'Provide a status and/or notes' });

/** Status and notes on one tool lead. Any signed-in staff member, like Inquiries. */
export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await props.params;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed' }, { status: 422 });

  const { lead } = await getLead(id);
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

  const patch: { status?: typeof lead.status; notes?: string | null } = {};
  if (parsed.data.status !== undefined) patch.status = parsed.data.status;
  if (parsed.data.notes !== undefined) patch.notes = parsed.data.notes;
  if (!(await updateLead(id, patch))) return NextResponse.json({ error: 'Update failed' }, { status: 500 });

  await writeAudit(createSupabaseServerClient(), {
    adminId: session.user.id,
    action: 'update',
    entityType: 'tool_leads',
    entityId: id,
    beforeValue: { status: lead.status, notes: lead.notes },
    afterValue: { status: patch.status ?? lead.status, notes: patch.notes !== undefined ? patch.notes : lead.notes },
  });
  return NextResponse.json({ ok: true });
}
