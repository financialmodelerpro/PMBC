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

  const parsed = settingsSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 422 },
    );
  }

  const supabase = createSupabaseServerClient();

  // Merge into the existing blob rather than overwriting it, so a partial
  // payload never drops keys it did not include.
  const { data: existingRow } = await supabase
    .from('site_settings')
    .select('settings')
    .eq('id', 1)
    .maybeSingle();
  const existing =
    existingRow?.settings && typeof existingRow.settings === 'object' && !Array.isArray(existingRow.settings)
      ? (existingRow.settings as Record<string, unknown>)
      : {};
  const merged = { ...existing, ...parsed.data };

  const { error } = await supabase
    .from('site_settings')
    .update({ settings: merged, updated_at: new Date().toISOString() })
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

export const PATCH = handleMutation;
export const POST = handleMutation;
