import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getAdminSession } from '@/lib/auth/requireAdmin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { writeAudit } from '@/lib/audit';
import { isSectionType } from '@/lib/cms/sectionTypes';

const sectionSchema = z.object({
  id: z.string().uuid(),
  page_slug: z.string().min(1),
  section_type: z.string().refine(isSectionType, { message: 'unknown section_type' }),
  content: z.unknown(),
  styles: z.unknown().optional(),
  display_order: z.number().int(),
  visible: z.boolean(),
});

const bodySchema = z.object({
  page_slug: z.string().min(1),
  sections: z.array(sectionSchema),
});

// Lightweight structural PATCH: persists ONLY order/visibility so an auto-save
// triggered by drag-reorder or the visibility toggle never flushes a user's
// in-progress (unsaved) content edits. Mirrors FMP's action-discriminator.
const reorderSchema = z.object({
  action: z.literal('reorder'),
  page_slug: z.string().min(1),
  items: z.array(
    z.object({ id: z.string().uuid(), display_order: z.number().int() }),
  ),
});

const visibilitySchema = z.object({
  action: z.literal('set_visibility'),
  page_slug: z.string().min(1),
  id: z.string().uuid(),
  visible: z.boolean(),
});

const patchSchema = z.discriminatedUnion('action', [reorderSchema, visibilitySchema]);

export async function PATCH(req: Request) {
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

  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 422 },
    );
  }

  const supabase = createSupabaseServerClient();
  const nowIso = new Date().toISOString();

  if (parsed.data.action === 'reorder') {
    for (const item of parsed.data.items) {
      const { error } = await supabase
        .from('page_sections')
        .update({ display_order: item.display_order, updated_at: nowIso })
        .eq('id', item.id)
        .eq('page_slug', parsed.data.page_slug);
      if (error) {
        return NextResponse.json(
          { error: `Failed to reorder ${item.id}: ${error.message}` },
          { status: 500 },
        );
      }
    }
  } else {
    const { error } = await supabase
      .from('page_sections')
      .update({ visible: parsed.data.visible, updated_at: nowIso })
      .eq('id', parsed.data.id)
      .eq('page_slug', parsed.data.page_slug);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  await supabase
    .from('cms_pages')
    .update({ updated_at: nowIso })
    .eq('slug', parsed.data.page_slug);

  await writeAudit(supabase, {
    adminId: session.user.id,
    action: parsed.data.action,
    entityType: 'page_sections',
    entityId: parsed.data.page_slug,
  });

  return NextResponse.json({ ok: true });
}

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

  const { page_slug, sections } = parsed.data;
  const supabase = createSupabaseServerClient();

  for (const s of sections) {
    if (s.page_slug !== page_slug) {
      return NextResponse.json(
        { error: `Section ${s.id} page_slug does not match body page_slug` },
        { status: 422 },
      );
    }
    const { error } = await supabase
      .from('page_sections')
      .update({
        section_type: s.section_type,
        content: s.content as never,
        styles: (s.styles ?? {}) as never,
        display_order: s.display_order,
        visible: s.visible,
        updated_at: new Date().toISOString(),
      })
      .eq('id', s.id);
    if (error) {
      return NextResponse.json(
        { error: `Failed to update section ${s.id}: ${error.message}` },
        { status: 500 },
      );
    }
  }

  // Bump cms_pages.updated_at so the dashboard reflects the change.
  await supabase
    .from('cms_pages')
    .update({ updated_at: new Date().toISOString() })
    .eq('slug', page_slug);

  await writeAudit(supabase, {
    adminId: session.user.id,
    action: 'update',
    entityType: 'page_sections',
    entityId: page_slug,
    metadata: { count: sections.length, ids: sections.map((s) => s.id) },
  });

  return NextResponse.json({ ok: true, updated: sections.length });
}
