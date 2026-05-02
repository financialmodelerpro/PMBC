import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getAdminSession } from '@/lib/auth/requireAdmin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { writeAudit } from '@/lib/audit';
import { defaultContentFor, isSectionType } from '@/lib/cms/sectionTypes';

const bodySchema = z.object({
  page_slug: z.string().min(1),
  section_type: z.string().refine(isSectionType, { message: 'unknown section_type' }),
  display_order: z.number().int().optional(),
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

  const { page_slug, section_type } = parsed.data;
  const supabase = createSupabaseServerClient();

  // Default to one past the current max display_order.
  let display_order = parsed.data.display_order;
  if (display_order === undefined) {
    const { data: maxRow } = await supabase
      .from('page_sections')
      .select('display_order')
      .eq('page_slug', page_slug)
      .order('display_order', { ascending: false })
      .limit(1)
      .maybeSingle();
    display_order = (maxRow?.display_order ?? -10) + 10;
  }

  const { data, error } = await supabase
    .from('page_sections')
    .insert({
      page_slug,
      section_type,
      content: defaultContentFor(section_type) as never,
      styles: {},
      display_order,
      visible: true,
    })
    .select('*')
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? 'Insert failed' },
      { status: 500 },
    );
  }

  await writeAudit(supabase, {
    adminId: session.user.id,
    action: 'create',
    entityType: 'page_sections',
    entityId: data.id,
    metadata: { page_slug, section_type },
  });

  return NextResponse.json({ ok: true, section: data });
}
