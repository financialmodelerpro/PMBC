import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getAdminSession } from '@/lib/auth/requireAdmin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { writeAudit } from '@/lib/audit';

const SECTION_RX = /^[a-z0-9_]+$/;
const KEY_RX = /^[a-zA-Z0-9_.-]+$/;

const bodySchema = z.object({
  section: z
    .string()
    .regex(SECTION_RX, 'section must be lowercase letters/numbers/underscores'),
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

export async function GET(req: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const section = url.searchParams.get('section');
  const supabase = createSupabaseServerClient();

  let query = supabase.from('cms_content').select('section, key, value, updated_at');
  if (section) query = query.eq('section', section);

  const { data, error } = await query.order('section').order('key');
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ rows: data ?? [] });
}

async function handleMutation(req: Request) {
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

  // PATCH-style upsert per FMP convention: try UPDATE, then INSERT if no row
  // matched. Using Postgres upsert here is functionally equivalent and atomic.
  if (upserts.length > 0) {
    const rows = upserts.map((u) => ({
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

export const PATCH = handleMutation;
// Keep POST as a backwards-compatible alias.
export const POST = handleMutation;
