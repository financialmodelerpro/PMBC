import { NextResponse } from 'next/server';
import { z } from 'zod';

import { writeAudit } from '@/lib/audit';
import { requireOwner } from '@/lib/auth/requireAdmin';
import { removeSuppression } from '@/lib/growth/suppression';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const schema = z.object({ reason: z.string().trim().min(1, 'Give a reason for removing it').max(500) });

/** Removes a suppression entry. The row stays as history with who, when and why. */
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const gate = await requireOwner();
  if (gate instanceof NextResponse) return gate;
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Validation failed' }, { status: 422 });

  const result = await removeSuppression(id, parsed.data.reason, { id: gate.user.id, name: gate.user.name || gate.user.email });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  await writeAudit(createSupabaseServerClient(), {
    adminId: gate.user.id,
    action: 'remove',
    entityType: 'growth_suppressions',
    entityId: id,
    beforeValue: { kind: result.row.kind, value: result.row.value, removed: false },
    afterValue: { removed: true, reason: result.row.removed_reason },
    reason: result.row.removed_reason,
  });
  return NextResponse.json({ row: result.row });
}
