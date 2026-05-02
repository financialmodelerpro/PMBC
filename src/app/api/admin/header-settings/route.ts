import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getAdminSession } from '@/lib/auth/requireAdmin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { writeAudit } from '@/lib/audit';
import type { TablesInsert } from '@/types/database';

const navItemSchema = z.object({
  label: z.string().min(1),
  href: z.string().min(1),
});

const configSchema = z.object({
  nav_items: z.array(navItemSchema),
  cta_label: z.string(),
  cta_href: z.string(),
  show_cta: z.boolean(),
  mobile_menu_enabled: z.boolean(),
});

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

  const parsed = configSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 422 },
    );
  }

  const supabase = createSupabaseServerClient();
  const now = new Date().toISOString();

  // Per FMP namespace convention: each setting is its own (section, key) row.
  const upserts: TablesInsert<'cms_content'>[] = [
    {
      section: 'header_settings',
      key: 'nav_items',
      value: JSON.stringify(parsed.data.nav_items),
      updated_at: now,
    },
    {
      section: 'header_settings',
      key: 'cta_label',
      value: parsed.data.cta_label,
      updated_at: now,
    },
    {
      section: 'header_settings',
      key: 'cta_href',
      value: parsed.data.cta_href,
      updated_at: now,
    },
    {
      section: 'header_settings',
      key: 'show_cta',
      value: parsed.data.show_cta ? 'true' : 'false',
      updated_at: now,
    },
    {
      section: 'header_settings',
      key: 'mobile_menu_enabled',
      value: parsed.data.mobile_menu_enabled ? 'true' : 'false',
      updated_at: now,
    },
  ];

  const { error } = await supabase
    .from('cms_content')
    .upsert(upserts, { onConflict: 'section,key' });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await writeAudit(supabase, {
    adminId: session.user.id,
    action: 'update',
    entityType: 'header_settings',
    entityId: 'all',
    metadata: {
      nav_count: parsed.data.nav_items.length,
      keys: upserts.map((u) => u.key),
    },
  });

  return NextResponse.json({ ok: true });
}

export const PATCH = handleMutation;
export const POST = handleMutation;
