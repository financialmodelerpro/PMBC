import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getAdminSession } from '@/lib/auth/requireAdmin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { writeAudit } from '@/lib/audit';

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

const bodySchema = z.object({
  logo_url: z.string().nullable(),
  primary_color: z.string().regex(HEX, 'primary_color must be a hex'),
  signature_html: z.string().nullable(),
  footer_html: z.string().nullable(),
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

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 422 },
    );
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from('email_branding')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await writeAudit(supabase, {
    adminId: session.user.id,
    action: 'update',
    entityType: 'email_branding',
    entityId: '1',
    metadata: { fields: Object.keys(parsed.data) },
  });

  return NextResponse.json({ ok: true });
}

export const PATCH = handleMutation;
export const POST = handleMutation;
