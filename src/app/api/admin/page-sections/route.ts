import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getAdminSession } from '@/lib/auth/requireAdmin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { forDiff, writeAudit } from '@/lib/audit';
import type { Json } from '@/types/database';
import { isSectionType } from '@/lib/cms/sectionTypes';
import { normalizeRichTextDeep } from '@/lib/cms/richText';
import {
  SLUG_RX,
  buildTemplateSections,
  isTemplateId,
  type TemplateId,
} from '@/lib/cms/pageTemplates';

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

/**
 * Create a page from a starter template. FMP puts this on the same endpoint
 * behind an `action` discriminator rather than a sub-route
 * (CMS_REFERENCE.md sections 2.2 and 5.3), so PMBC does the same.
 */
const createPageSchema = z.object({
  action: z.literal('create_page'),
  title: z.string().trim().min(1, 'Title is required').max(200),
  slug: z
    .string()
    .trim()
    .min(1, 'Slug is required')
    .max(80)
    .regex(SLUG_RX, 'Slug may contain only lowercase letters, numbers and hyphens'),
  template: z.string().refine(isTemplateId, { message: 'unknown template' }),
  status: z.enum(['draft', 'published']).default('draft'),
});

const deletePageSchema = z.object({
  action: z.literal('delete_page'),
  slug: z.string().trim().min(1),
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

  // Route on the discriminator first, so the batch-save shape (which carries no
  // `action`) stays exactly as it was.
  if (
    json &&
    typeof json === 'object' &&
    (json as { action?: unknown }).action === 'create_page'
  ) {
    return handleCreatePage(json, session.user.id);
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
        // Normalised on the way in, so what is stored is what renders. Doing
        // it here rather than in the editor's onChange is deliberate: stripping
        // an empty paragraph mid-keystroke would delete the one the author just
        // created by pressing Enter, and fight the cursor. The save boundary is
        // the only safe moment.
        content: normalizeRichTextDeep(s.content) as never,
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

async function handleCreatePage(json: unknown, adminId: string) {
  const parsed = createPageSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message ?? 'Validation failed',
        issues: parsed.error.issues,
      },
      { status: 422 },
    );
  }

  const { title, slug, template, status } = parsed.data;
  const supabase = createSupabaseServerClient();

  // Explicit pre-check so the admin gets "that slug is taken" rather than a raw
  // unique-constraint violation. The UNIQUE index is still the real guard: two
  // simultaneous creates would race past this, and the insert below is what
  // actually rejects the loser.
  const { data: existing } = await supabase
    .from('cms_pages')
    .select('slug')
    .eq('slug', slug)
    .maybeSingle();
  if (existing) {
    return NextResponse.json(
      { error: `A page with the slug "${slug}" already exists` },
      { status: 409 },
    );
  }

  const nowIso = new Date().toISOString();
  const { data: page, error: pageError } = await supabase
    .from('cms_pages')
    .insert({
      slug,
      title,
      status,
      // `is_system` is deliberately NOT set here. The column defaults to false
      // (migration 031), so admin-created pages are deletable, and omitting it
      // means this insert also succeeds on a database where 031 has not been
      // applied yet rather than failing on an unknown column.
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select('*')
    .single();

  if (pageError || !page) {
    // 23505 is Postgres unique_violation: the race described above.
    const isDuplicate = (pageError as { code?: string } | null)?.code === '23505';
    return NextResponse.json(
      {
        error: isDuplicate
          ? `A page with the slug "${slug}" already exists`
          : (pageError?.message ?? 'Could not create page'),
      },
      { status: isDuplicate ? 409 : 500 },
    );
  }

  const rows = buildTemplateSections(template as TemplateId, slug);
  if (rows.length > 0) {
    const { error: sectionsError } = await supabase
      .from('page_sections')
      .insert(rows as never);
    if (sectionsError) {
      // Roll the page back by hand: Postgres cannot undo the insert above from
      // here, and leaving a page with a half-applied template is worse than
      // leaving nothing, because the admin cannot tell which sections are
      // missing.
      await supabase.from('cms_pages').delete().eq('slug', slug);
      return NextResponse.json(
        { error: `Could not seed template sections: ${sectionsError.message}` },
        { status: 500 },
      );
    }
  }

  await writeAudit(supabase, {
    adminId,
    action: 'create',
    entityType: 'cms_pages',
    entityId: slug,
    metadata: { page_slug: slug, title, template, section_count: rows.length, status },
    beforeValue: null,
    afterValue: forDiff(page as unknown as Json),
  });

  return NextResponse.json({ page, section_count: rows.length }, { status: 201 });
}

/**
 * Delete a page and its sections. Child rows go first: `page_sections.page_slug`
 * is a slug reference rather than a real foreign key, so nothing would cascade
 * on its own and the sections would be orphaned.
 */
export async function DELETE(req: Request) {
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

  const parsed = deletePageSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 422 },
    );
  }

  const { slug } = parsed.data;
  const supabase = createSupabaseServerClient();

  const { data: page, error: readError } = await supabase
    .from('cms_pages')
    .select('slug, title, is_system')
    .eq('slug', slug)
    .maybeSingle();

  if (readError) {
    // Before migration 031 the column does not exist and this select fails.
    // Refuse the delete rather than guessing: without the flag there is no way
    // to tell a system page from an admin-created one, and deleting a page that
    // backs a live public route is not a mistake worth risking.
    return NextResponse.json(
      {
        error:
          'Page deletion is unavailable until migration 031 (cms_pages.is_system) has been applied.',
      },
      { status: 409 },
    );
  }
  if (!page) {
    return NextResponse.json({ error: `No page with slug "${slug}"` }, { status: 404 });
  }

  // Server-side guard. The list hides the delete control for system pages, but
  // the UI is not the security boundary: a hand-rolled request must be refused
  // too, or the flag is decoration.
  if (page.is_system) {
    return NextResponse.json(
      { error: `"${page.title}" is a system page and cannot be deleted` },
      { status: 403 },
    );
  }

  const { data: removedSections, error: sectionsError } = await supabase
    .from('page_sections')
    .delete()
    .eq('page_slug', slug)
    .select('id');
  if (sectionsError) {
    return NextResponse.json(
      { error: `Could not delete sections: ${sectionsError.message}` },
      { status: 500 },
    );
  }

  const { error: pageError } = await supabase.from('cms_pages').delete().eq('slug', slug);
  if (pageError) {
    return NextResponse.json({ error: pageError.message }, { status: 500 });
  }

  await writeAudit(supabase, {
    adminId: session.user.id,
    action: 'delete',
    entityType: 'cms_pages',
    entityId: slug,
    metadata: {
      page_slug: slug,
      title: page.title,
      section_count: removedSections?.length ?? 0,
    },
    beforeValue: forDiff(page as unknown as Json),
    afterValue: null,
  });

  return NextResponse.json({
    ok: true,
    deleted_sections: removedSections?.length ?? 0,
  });
}
