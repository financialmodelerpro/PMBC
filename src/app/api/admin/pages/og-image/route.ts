import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getAdminSession } from '@/lib/auth/requireAdmin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { writeAudit } from '@/lib/audit';

const bodySchema = z.object({
  slug: z.string().min(1),
  // Accept null, empty string (clear override), or a valid URL.
  og_image_url: z
    .union([z.literal(''), z.null(), z.string().url()])
    .transform((v) => (v ? v : null)),
});

async function handle(req: Request) {
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

  const { slug, og_image_url } = parsed.data;
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from('cms_pages')
    .update({ og_image_url, updated_at: new Date().toISOString() })
    .eq('slug', slug)
    .select('slug, og_image_url')
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: `No cms_pages row for slug "${slug}"` }, { status: 404 });
  }

  await writeAudit(supabase, {
    adminId: session.user.id,
    action: 'update',
    entityType: 'cms_pages',
    entityId: slug,
    metadata: { og_image_url },
  });

  return NextResponse.json({ ok: true, row: data });
}

export const PATCH = handle;
export const POST = handle;
