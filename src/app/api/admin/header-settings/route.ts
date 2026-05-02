import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getAdminSession } from '@/lib/auth/requireAdmin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { writeAudit } from '@/lib/audit';

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

  const parsed = configSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 422 },
    );
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from('cms_content')
    .upsert(
      {
        section: 'header_settings',
        key: 'config',
        value: JSON.stringify(parsed.data),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'section,key' },
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await writeAudit(supabase, {
    adminId: session.user.id,
    action: 'update',
    entityType: 'header_settings',
    entityId: 'config',
    metadata: { nav_count: parsed.data.nav_items.length },
  });

  return NextResponse.json({ ok: true });
}
