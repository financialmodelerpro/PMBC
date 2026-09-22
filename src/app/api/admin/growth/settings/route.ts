import { NextResponse } from 'next/server';

import { writeAudit } from '@/lib/audit';
import { requireOwner } from '@/lib/auth/requireAdmin';
import { getGrowthSettings, updateGrowthSettings } from '@/lib/growth/settings';
import { settingsSchema } from '@/lib/growth/settingsModel';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** Saves the Growth settings. The database checks every limit again and logs each change. */
export async function PATCH(req: Request) {
  const gate = await requireOwner();
  if (gate instanceof NextResponse) return gate;
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = settingsSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Validation failed' }, { status: 422 });

  const before = await getGrowthSettings();
  const result = await updateGrowthSettings(parsed.data, { id: gate.user.id, name: gate.user.name || gate.user.email });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  await writeAudit(createSupabaseServerClient(), {
    adminId: gate.user.id,
    action: 'update',
    entityType: 'growth_settings',
    entityId: '1',
    beforeValue: before.source === 'database' ? before.settings : null,
    afterValue: result.settings,
  });
  return NextResponse.json({ settings: result.settings });
}
