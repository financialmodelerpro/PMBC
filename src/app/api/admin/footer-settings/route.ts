import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/requireAdmin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { writeAudit } from '@/lib/audit';
import { footerSettingsSchema } from '@/lib/cms/footerSettings';
import type { TablesInsert } from '@/types/database';

/**
 * Footer presentation keys under the `footer_settings` section of `cms_content`.
 *
 * A separate route from /api/admin/header-settings rather than an extension of
 * it: that route writes every key it builds into the `header_settings` section
 * unconditionally, so footer keys would land in the wrong namespace. The admin
 * form still presents one Save All and fires this alongside the other two
 * requests, which is the pattern branding already follows.
 */

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

  const parsed = footerSettingsSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 422 },
    );
  }

  const supabase = createSupabaseServerClient();
  const now = new Date().toISOString();
  const upserts: TablesInsert<'cms_content'>[] = [];

  /** Only writes fields the client actually sent, so a partial PATCH never blanks a key. */
  const putIf = (key: string, value: string | boolean | undefined) => {
    if (value === undefined) return;
    upserts.push({
      section: 'footer_settings',
      key,
      value: typeof value === 'boolean' ? (value ? 'true' : 'false') : value,
      updated_at: now,
    });
  };

  const d = parsed.data;
  putIf('footer_logo_height_px', d.footer_logo_height_px);
  putIf('footer_logo_width_px', d.footer_logo_width_px);
  putIf('footer_logo_enabled', d.footer_logo_enabled);

  if (upserts.length === 0) {
    return NextResponse.json({ ok: true, keys: [] });
  }

  const { data: before } = await supabase
    .from('cms_content')
    .select('key, value')
    .eq('section', 'footer_settings')
    .in('key', upserts.map((u) => u.key));

  const { error } = await supabase
    .from('cms_content')
    .upsert(upserts, { onConflict: 'section,key' });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await writeAudit(supabase, {
    adminId: session.user.id,
    action: 'update',
    entityType: 'footer_settings',
    entityId: 'all',
    metadata: { keys: upserts.map((u) => u.key) },
    beforeValue: Object.fromEntries((before ?? []).map((r) => [r.key, r.value])),
    afterValue: Object.fromEntries(upserts.map((u) => [u.key, u.value])),
  });

  return NextResponse.json({ ok: true, keys: upserts.map((u) => u.key) });
}

export const PATCH = handleMutation;
export const POST = handleMutation;
