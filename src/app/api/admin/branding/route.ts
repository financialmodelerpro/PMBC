import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getAdminSession } from '@/lib/auth/requireAdmin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { writeAudit } from '@/lib/audit';

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

const bodySchema = z.object({
  logo_url: z.string().nullable(),
  logo_dark_url: z.string().nullable(),
  favicon_url: z.string().nullable(),
  brand_name: z.string().min(1, 'brand_name required'),
  short_name: z.string().min(1, 'short_name required'),
  tagline: z.string().min(1, 'tagline required'),
  primary_color: z.string().regex(HEX, 'primary_color must be a hex'),
  secondary_color: z.string().regex(HEX, 'secondary_color must be a hex'),
  accent_color: z.string().regex(HEX, 'accent_color must be a hex'),
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

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from('branding_config')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await writeAudit(supabase, {
    adminId: session.user.id,
    action: 'update',
    entityType: 'branding_config',
    entityId: '1',
    metadata: { fields: Object.keys(parsed.data) },
  });

  return NextResponse.json({ ok: true });
}
