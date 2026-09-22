import { NextResponse } from 'next/server';

import { writeAudit } from '@/lib/audit';
import { requireOwner } from '@/lib/auth/requireAdmin';
import { importOptOuts } from '@/lib/growth/suppression';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** Imports existing opt-outs. Safe to run again: addresses already suppressed are skipped. */
export async function POST() {
  const gate = await requireOwner();
  if (gate instanceof NextResponse) return gate;
  const result = await importOptOuts({ id: gate.user.id, name: gate.user.name || gate.user.email });
  await writeAudit(createSupabaseServerClient(), {
    adminId: gate.user.id,
    action: 'import',
    entityType: 'growth_suppressions',
    entityId: null,
    afterValue: result,
  });
  return NextResponse.json(result, { status: result.errors.length ? 207 : 200 });
}
