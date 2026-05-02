import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getAdminSession } from '@/lib/auth/requireAdmin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { writeAudit } from '@/lib/audit';

const settingsSchema = z.object({
  contact_email: z.string().email().or(z.literal('')).optional(),
  admin_email: z.string().email().or(z.literal('')).optional(),
  whatsapp_number: z.string().optional(),
  phone_number: z.string().optional(),
  office_location_text: z.string().optional(),
  social_linkedin: z.string().optional(),
  social_twitter: z.string().optional(),
  default_og_image_url: z.string().optional(),
  google_analytics_id: z.string().optional(),
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

  const parsed = settingsSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 422 },
    );
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from('site_settings')
    .update({ settings: parsed.data, updated_at: new Date().toISOString() })
    .eq('id', 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await writeAudit(supabase, {
    adminId: session.user.id,
    action: 'update',
    entityType: 'site_settings',
    entityId: '1',
    metadata: { keys: Object.keys(parsed.data) },
  });

  return NextResponse.json({ ok: true });
}
