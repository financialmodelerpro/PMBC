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

/**
 * A numeric-pixel field. Stored as TEXT because cms_content values are always
 * TEXT, and blank is meaningful ("auto" / inherit), so this is not z.number().
 */
const pxField = z
  .string()
  .regex(/^\d*$/, 'must be a whole number of pixels, or blank for auto');

const configSchema = z.object({
  // Optional since migration 027: nav items are `site_pages` rows edited at
  // /admin/pages. Still accepted so an older client (or a manual call) can
  // write the legacy fallback row, but the admin UI no longer sends it.
  nav_items: z.array(navItemSchema).optional(),

  cta_label: z.string(),
  cta_href: z.string(),
  show_cta: z.boolean(),
  mobile_menu_enabled: z.boolean(),

  // Phase 1 parity keys. All optional so an older client that only knows the
  // four CTA/mobile fields keeps working instead of failing validation.
  logo_enabled: z.boolean().optional(),
  logo_width_px: pxField.optional(),
  logo_height_px: pxField.optional(),
  logo_position: z.enum(['left', 'center', 'right']).optional(),

  show_brand_name: z.boolean().optional(),
  show_tagline: z.boolean().optional(),

  icon_url: z.string().optional(),
  icon_as_favicon: z.boolean().optional(),
  icon_in_header: z.boolean().optional(),
  icon_size_px: pxField.optional(),

  header_height_px: pxField.optional(),
  header_padding_top_px: pxField.optional(),
  header_padding_bottom_px: pxField.optional(),
  header_layout: z.enum(['default', 'centered', 'spread']).optional(),
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
  const upserts: TablesInsert<'cms_content'>[] = [];

  const put = (key: string, value: string) => {
    upserts.push({ section: 'header_settings', key, value, updated_at: now });
  };

  /** Only writes when the client actually sent the field, so a partial PATCH
   *  never blanks a key it did not intend to touch. */
  const putIf = (key: string, value: string | boolean | undefined) => {
    if (value === undefined) return;
    put(key, typeof value === 'boolean' ? (value ? 'true' : 'false') : value);
  };

  const d = parsed.data;

  put('cta_label', d.cta_label);
  put('cta_href', d.cta_href);
  put('show_cta', d.show_cta ? 'true' : 'false');
  put('mobile_menu_enabled', d.mobile_menu_enabled ? 'true' : 'false');

  putIf('logo_enabled', d.logo_enabled);
  putIf('logo_width_px', d.logo_width_px);
  putIf('logo_height_px', d.logo_height_px);
  putIf('logo_position', d.logo_position);

  putIf('show_brand_name', d.show_brand_name);
  putIf('show_tagline', d.show_tagline);

  putIf('icon_url', d.icon_url);
  putIf('icon_as_favicon', d.icon_as_favicon);
  putIf('icon_in_header', d.icon_in_header);
  putIf('icon_size_px', d.icon_size_px);

  putIf('header_height_px', d.header_height_px);
  putIf('header_padding_top_px', d.header_padding_top_px);
  putIf('header_padding_bottom_px', d.header_padding_bottom_px);
  putIf('header_layout', d.header_layout);

  if (d.nav_items) {
    put('nav_items', JSON.stringify(d.nav_items));
  }

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
      nav_count: d.nav_items?.length ?? null,
      keys: upserts.map((u) => u.key),
    },
  });

  return NextResponse.json({ ok: true });
}

export const PATCH = handleMutation;
export const POST = handleMutation;
