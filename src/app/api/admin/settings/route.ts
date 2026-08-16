import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireOwner } from '@/lib/auth/requireAdmin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { writeAudit } from '@/lib/audit';
import type { Json } from '@/types/database';

const settingsSchema = z.object({
  contact_email: z.string().email().or(z.literal('')).optional(),
  contact_email_advisory: z.string().email().or(z.literal('')).optional(),
  contact_email_founder: z.string().email().or(z.literal('')).optional(),
  contact_label_general: z.string().optional(),
  contact_label_advisory: z.string().optional(),
  contact_label_founder: z.string().optional(),
  admin_email: z.string().email().or(z.literal('')).optional(),
  whatsapp_number: z.string().optional(),
  phone_number: z.string().optional(),
  office_location_text: z.string().optional(),
  booking_url: z.string().optional(),
  social_linkedin: z.string().optional(),
  social_twitter: z.string().optional(),
  default_og_image_url: z.string().optional(),
  google_analytics_id: z.string().optional(),
  /**
   * Whether the client testimonial submission form is offered publicly.
   *
   * A boolean rather than a string, and it lives here rather than on each
   * section, because the question is one answer for the whole site. Absent
   * means off, which is what `isTestimonialFormPublic` reads.
   */
  testimonial_form_public: z.boolean().optional(),
});

async function handleMutation(req: Request) {
  const gate = await requireOwner();
  if (gate instanceof NextResponse) return gate;
  const session = gate;

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
    // The existing blob was already read above to build the merge, so the
    // before-value costs no extra query here.
    beforeValue: existing as Json,
    afterValue: merged as Json,
  });

  return NextResponse.json({ ok: true });
}

/**
 * Read the settings blob.
 *
 * Admin only, like the mutations: these are the site-wide values, and the
 * blob carries published addresses and analytics ids. An editor calling this
 * gets a 403, which the Testimonials screen treats as "do not offer the
 * switch" rather than as an error.
 */
export async function GET() {
  const gate = await requireOwner();
  if (gate instanceof NextResponse) return gate;

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('site_settings')
    .select('settings')
    .eq('id', 1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const settings =
    data?.settings && typeof data.settings === 'object' && !Array.isArray(data.settings)
      ? data.settings
      : {};
  return NextResponse.json({ settings });
}

export const PATCH = handleMutation;
export const POST = handleMutation;
