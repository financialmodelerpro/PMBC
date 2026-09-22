import { NextResponse } from 'next/server';

import { writeAudit } from '@/lib/audit';
import { requireOwner } from '@/lib/auth/requireAdmin';
import { createKbItem } from '@/lib/growth/kb';
import { kbCreateSchema } from '@/lib/growth/kbModel';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** Creates a Knowledge Base item as a draft. Admins only, like every Growth route. */
export async function POST(req: Request) {
  const gate = await requireOwner();
  if (gate instanceof NextResponse) return gate;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = kbCreateSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Validation failed' }, { status: 422 });

  const result = await createKbItem(parsed.data, { id: gate.user.id, name: gate.user.name || gate.user.email });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  await writeAudit(createSupabaseServerClient(), {
    adminId: gate.user.id,
    action: 'create',
    entityType: 'growth_kb_items',
    entityId: result.item.id,
    afterValue: { kind: result.item.kind, title: result.item.title, status: result.item.status },
  });
  return NextResponse.json({ item: result.item });
}
