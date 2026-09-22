import { NextResponse } from 'next/server';

import { writeAudit } from '@/lib/audit';
import { requireOwner } from '@/lib/auth/requireAdmin';
import { actOnKbItem, editKbItem, getKbItem } from '@/lib/growth/kb';
import { kbActionSchema, kbEditSchema } from '@/lib/growth/kbModel';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

async function body(req: Request): Promise<unknown | NextResponse> {
  try {
    return await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
}

/** Edits the working copy. An approved item keeps serving its approved copy until approved again. */
export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const gate = await requireOwner();
  if (gate instanceof NextResponse) return gate;
  const { id } = await props.params;
  const json = await body(req);
  if (json instanceof NextResponse) return json;
  const parsed = kbEditSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Validation failed' }, { status: 422 });

  const before = await getKbItem(id);
  const result = await editKbItem(id, parsed.data, { id: gate.user.id, name: gate.user.name || gate.user.email });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  await writeAudit(createSupabaseServerClient(), {
    adminId: gate.user.id,
    action: 'update',
    entityType: 'growth_kb_items',
    entityId: id,
    beforeValue: before ? { title: before.title, content: before.content, status: before.status } : null,
    afterValue: { title: result.item.title, content: result.item.content, status: result.item.status },
  });
  return NextResponse.json({ item: result.item });
}

/** Approve, archive or restore. */
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const gate = await requireOwner();
  if (gate instanceof NextResponse) return gate;
  const { id } = await props.params;
  const json = await body(req);
  if (json instanceof NextResponse) return json;
  const parsed = kbActionSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'Unknown action' }, { status: 422 });

  const before = await getKbItem(id);
  const result = await actOnKbItem(id, parsed.data.action, { id: gate.user.id, name: gate.user.name || gate.user.email });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  await writeAudit(createSupabaseServerClient(), {
    adminId: gate.user.id,
    action: parsed.data.action,
    entityType: 'growth_kb_items',
    entityId: id,
    beforeValue: before ? { status: before.status, approved_at: before.approved_at } : null,
    afterValue: { status: result.item.status, approved_at: result.item.approved_at },
  });
  return NextResponse.json({ item: result.item });
}
