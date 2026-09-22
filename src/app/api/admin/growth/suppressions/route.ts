import { NextResponse } from 'next/server';
import { z } from 'zod';

import { writeAudit } from '@/lib/audit';
import { requireOwner } from '@/lib/auth/requireAdmin';
import { addSuppression } from '@/lib/growth/suppression';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const schema = z.object({
  kind: z.enum(['email', 'domain']),
  value: z.string().trim().min(3).max(320),
  reason: z.string().trim().min(1, 'Give a reason').max(500),
});

/** Adds an email or domain to the suppression list by hand. */
export async function POST(req: Request) {
  const gate = await requireOwner();
  if (gate instanceof NextResponse) return gate;
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Validation failed' }, { status: 422 });

  const result = await addSuppression(parsed.data, { id: gate.user.id, name: gate.user.name || gate.user.email });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  await writeAudit(createSupabaseServerClient(), {
    adminId: gate.user.id,
    action: 'create',
    entityType: 'growth_suppressions',
    entityId: result.row.id,
    afterValue: { kind: result.row.kind, value: result.row.value, reason: result.row.reason },
  });
  return NextResponse.json({ row: result.row });
}
