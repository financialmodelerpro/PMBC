import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getAdminSession, canDelete, forbidden } from '@/lib/auth/requireAdmin';
import { writeAudit } from '@/lib/audit';
import { generateToken, isMissingSchema } from '@/lib/cms/testimonialLinks';

export const dynamic = 'force-dynamic';

/**
 * Private testimonial links.
 *
 * Open to both roles, unlike Users or Site Settings: sending a client a link to
 * leave a testimonial is content work, and the moderation queue that reviews
 * what comes back is already open to editors. Deleting a link is still admin
 * only, like every other delete.
 *
 * **Revoking is the normal operation, not deleting.** `active = false` keeps
 * the row, so a testimonial that arrived through it can still say where it came
 * from. Delete exists for a link created by mistake and never sent.
 */
function looseDb(): SupabaseClient {
  // The generated types predate migration 072, which is DDL and hand-run.
  return createSupabaseServerClient() as unknown as SupabaseClient;
}

const createSchema = z.object({
  label: z.string().trim().min(1, 'Give the link a label so you can tell it apart').max(160),
  note: z.string().trim().max(500).optional().or(z.literal('')),
});

const patchSchema = z.object({
  id: z.string().uuid(),
  active: z.boolean(),
});

/** The message shown when migration 072 has not been applied. */
const NOT_APPLIED =
  'Migration 072 has not been applied yet. Paste supabase/migrations/072_testimonial_submissions.sql into the Supabase SQL editor, then reload.';

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = looseDb();
  const { data, error } = await supabase
    .from('testimonial_links')
    .select('id, token, label, note, active, created_at, last_used_at, use_count')
    .order('created_at', { ascending: false });

  if (error) {
    if (isMissingSchema(error.message)) {
      return NextResponse.json({ rows: [], schemaReady: false, error: NOT_APPLIED });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ rows: data ?? [], schemaReady: true });
}

export async function POST(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
      { status: 400 },
    );
  }

  const supabase = looseDb();
  const { data, error } = await supabase
    .from('testimonial_links')
    .insert({
      token: generateToken(),
      label: parsed.data.label,
      note: parsed.data.note || null,
      created_by: session.user.id,
    })
    .select('id, token, label, note, active, created_at, last_used_at, use_count')
    .single();

  if (error) {
    if (isMissingSchema(error.message)) {
      return NextResponse.json({ error: NOT_APPLIED }, { status: 503 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await writeAudit(createSupabaseServerClient(), {
    adminId: session.user.id,
    action: 'create',
    entityType: 'testimonial_links',
    entityId: data.id,
    // The label, never the token. An audit row is readable by anyone who can
    // reach the audit log, and the token is the secret in the URL.
    afterValue: { label: data.label },
  });

  return NextResponse.json({ row: data });
}

/** Revoke or restore. */
export async function PATCH(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  const supabase = looseDb();
  const { data, error } = await supabase
    .from('testimonial_links')
    .update({ active: parsed.data.active })
    .eq('id', parsed.data.id)
    .select('id, token, label, note, active, created_at, last_used_at, use_count')
    .single();

  if (error) {
    if (isMissingSchema(error.message)) {
      return NextResponse.json({ error: NOT_APPLIED }, { status: 503 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await writeAudit(createSupabaseServerClient(), {
    adminId: session.user.id,
    action: 'update',
    entityType: 'testimonial_links',
    entityId: parsed.data.id,
    afterValue: { label: data.label, active: data.active },
  });

  return NextResponse.json({ row: data });
}

export async function DELETE(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canDelete(session)) {
    return forbidden('Editors cannot delete a link. Revoke it instead, which stops it working and keeps the record.');
  }

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const supabase = looseDb();
  const { data: before } = await supabase
    .from('testimonial_links')
    .select('id, label, use_count')
    .eq('id', id)
    .maybeSingle();

  // A link that produced testimonials keeps its row, so those rows can still
  // say where they came from. The foreign key is ON DELETE SET NULL, so a
  // delete would not fail; it would quietly detach the history instead.
  if (before && (before.use_count ?? 0) > 0) {
    return NextResponse.json(
      {
        error:
          'This link has been used, so deleting it would detach the testimonials it produced. Revoke it instead.',
      },
      { status: 400 },
    );
  }

  const { error } = await supabase.from('testimonial_links').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAudit(createSupabaseServerClient(), {
    adminId: session.user.id,
    action: 'delete',
    entityType: 'testimonial_links',
    entityId: id,
    beforeValue: before ? { label: before.label } : null,
    afterValue: null,
  });

  return NextResponse.json({ ok: true });
}
