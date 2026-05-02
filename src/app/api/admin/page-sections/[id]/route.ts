import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getAdminSession } from '@/lib/auth/requireAdmin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { writeAudit } from '@/lib/audit';

const idSchema = z.string().uuid();

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await ctx.params;
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();

  // Read first so we can audit page_slug + type.
  const { data: row } = await supabase
    .from('page_sections')
    .select('id, page_slug, section_type')
    .eq('id', parsed.data)
    .maybeSingle();

  if (!row) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { error } = await supabase.from('page_sections').delete().eq('id', parsed.data);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await writeAudit(supabase, {
    adminId: session.user.id,
    action: 'delete',
    entityType: 'page_sections',
    entityId: row.id,
    metadata: { page_slug: row.page_slug, section_type: row.section_type },
  });

  return NextResponse.json({ ok: true });
}
