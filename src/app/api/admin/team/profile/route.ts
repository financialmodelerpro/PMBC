import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getAdminSession } from '@/lib/auth/requireAdmin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { writeAudit } from '@/lib/audit';
import { slugify } from '@/lib/admin/slugify';
import { defaultContentFor } from '@/lib/cms/sectionTypes';
import { PROFILE_SLUG_PREFIX } from '@/lib/cms/teamProfiles';

const bodySchema = z.object({ id: z.string().uuid() });

/**
 * Creates a member's full profile page from their screen in Team & Advisors,
 * so a new person needs no code: the page is `about-<name>`, served at
 * `/team/<name>` by the shared profile route, and linked to the member through
 * `team_members.profile_slug` (migration 109).
 *
 * It starts with three sections: the header (name, photo and credentials come
 * from the member), "Selected experience" marked "Show on team card", and
 * "Areas of expertise". The page is published, but nothing shows until the
 * member is published too, and the empty lists render nothing.
 *
 * Any signed-in staff member may create one, as with every other create.
 * Refused when the member already has a profile, or when the slug is taken by a
 * page another member links to.
 */
export async function POST(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 422 });
  }

  const supabase = createSupabaseServerClient();
  const { data: member, error: memberErr } = await supabase
    .from('team_members')
    .select('*')
    .eq('id', parsed.data.id)
    .maybeSingle();
  if (memberErr) return NextResponse.json({ error: memberErr.message }, { status: 500 });
  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  if (!('profile_slug' in member)) {
    return NextResponse.json(
      { error: 'Migration 109 has not been applied yet, so a profile cannot be linked.', code: 'migration_109' },
      { status: 409 },
    );
  }
  if (member.profile_slug) {
    return NextResponse.json({ error: 'This member already has a profile page.' }, { status: 409 });
  }

  // "Muhammad Shahjahan, ACMA" -> about-muhammad-shahjahan: a suffix after the
  // comma is a qualification, not part of the address.
  const base = slugify(member.name.split(',')[0] ?? '');
  if (!base) return NextResponse.json({ error: 'The member needs a name first.' }, { status: 422 });
  const slug = `${PROFILE_SLUG_PREFIX}${base}`;

  const { data: taken } = await supabase
    .from('team_members')
    .select('id')
    .eq('profile_slug', slug)
    .maybeSingle();
  if (taken) {
    return NextResponse.json(
      { error: `Another member already uses /team/${base}. Change this member's name first.` },
      { status: 409 },
    );
  }

  // A page left behind by an earlier member of the same name is adopted rather
  // than duplicated: its sections are kept as they are.
  const { data: existingPage } = await supabase
    .from('cms_pages')
    .select('slug')
    .eq('slug', slug)
    .maybeSingle();

  if (!existingPage) {
    const role = member.role?.trim() ?? '';
    const { error: pageErr } = await supabase.from('cms_pages').insert({
      slug,
      title: member.name,
      meta_title: `${member.name}${role ? ` | ${role}` : ''} | PaceMakers`,
      meta_description: `${member.name}${role ? `, ${role},` : ''} at PaceMakers Business Consultants.`,
      status: 'published',
      is_system: true,
    });
    if (pageErr) return NextResponse.json({ error: pageErr.message }, { status: 500 });

    const { error: sectionsErr } = await supabase.from('page_sections').insert([
      {
        page_slug: slug,
        section_type: 'founder_hero',
        display_order: 10,
        visible: true,
        styles: {},
        content: { ...(defaultContentFor('founder_hero') as Record<string, unknown>), eyebrow: 'Team' } as never,
      },
      {
        page_slug: slug,
        section_type: 'founder_credentials',
        display_order: 20,
        visible: true,
        styles: {},
        content: {
          ...(defaultContentFor('founder_credentials') as Record<string, unknown>),
          heading: 'Selected experience',
          display: 'numbered',
          show_on_card: true,
        } as never,
      },
      {
        page_slug: slug,
        section_type: 'founder_credentials',
        display_order: 30,
        visible: true,
        styles: {},
        content: {
          ...(defaultContentFor('founder_credentials') as Record<string, unknown>),
          heading: 'Areas of expertise',
          display: 'pills',
        } as never,
      },
    ]);
    if (sectionsErr) return NextResponse.json({ error: sectionsErr.message }, { status: 500 });
  }

  const { error: linkErr } = await supabase
    .from('team_members')
    .update({ profile_slug: slug })
    .eq('id', member.id);
  if (linkErr) return NextResponse.json({ error: linkErr.message }, { status: 500 });

  await writeAudit(supabase, {
    adminId: session.user.id,
    action: 'create',
    entityType: 'team_profile',
    entityId: member.id,
    metadata: { page_slug: slug, adopted_existing_page: Boolean(existingPage) },
  });

  return NextResponse.json({ ok: true, profile_slug: slug });
}
