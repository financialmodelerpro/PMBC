import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getAdminSession } from '@/lib/auth/requireAdmin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { writeAudit } from '@/lib/audit';
import type { TablesInsert } from '@/types/database';

const SECTION_RX = /^[a-z0-9_]+$/;
const KEY_RX = /^[a-zA-Z0-9_.-]+$/;

const bodySchema = z.object({
  section: z.string().regex(SECTION_RX, 'section must be lowercase letters/numbers/underscores'),
  upserts: z
    .array(
      z.object({
        key: z.string().regex(KEY_RX, 'invalid key'),
        value: z.string().nullable(),
      }),
    )
    .default([]),
  deletes: z.array(z.string()).default([]),
});

export async function POST(req: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 422 },
    );
  }

  const { section, upserts, deletes } = parsed.data;
  const supabase = createSupabaseServerClient();

  if (upserts.length > 0) {
    const rows: TablesInsert<'cms_content'>[] = upserts.map((u) => ({
      section,
      key: u.key,
      value: u.value,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase
      .from('cms_content')
      .upsert(rows, { onConflict: 'section,key' });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  if (deletes.length > 0) {
    const { error } = await supabase
      .from('cms_content')
      .delete()
      .eq('section', section)
      .in('key', deletes);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  await writeAudit(supabase, {
    adminId: session.user.id,
    action: 'update',
    entityType: 'cms_content',
    entityId: section,
    metadata: {
      upserted_keys: upserts.map((u) => u.key),
      deleted_keys: deletes,
    },
  });

  return NextResponse.json({ ok: true });
}
