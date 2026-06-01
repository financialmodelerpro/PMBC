import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getAdminSession } from '@/lib/auth/requireAdmin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { writeAudit } from '@/lib/audit';

export const STATUSES = ['new', 'read', 'responded', 'archived'] as const;
type Status = (typeof STATUSES)[number];

const SELECT_COLUMNS =
  'id, name, email, company, phone, country, service_interest, message, source_page, status, notes, created_at, read_at, responded_at';

export async function GET(req: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  const supabase = createSupabaseServerClient();

  let query = supabase
    .from('contact_submissions')
    .select(SELECT_COLUMNS)
    .order('created_at', { ascending: false });

  if (status && (STATUSES as readonly string[]).includes(status)) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ rows: data ?? [] });
}

const bodySchema = z
  .object({
    id: z.string().uuid('id must be a valid submission id'),
    status: z.enum(STATUSES).optional(),
    notes: z.string().max(10000).nullable().optional(),
  })
  .refine((b) => b.status !== undefined || b.notes !== undefined, {
    message: 'Provide a status and/or notes to update',
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

  const { id, status, notes } = parsed.data;
  const supabase = createSupabaseServerClient();

  // Read the current row so we can preserve existing first-touch timestamps and
  // confirm the row exists before writing.
  const { data: current, error: readErr } = await supabase
    .from('contact_submissions')
    .select('status, read_at, responded_at')
    .eq('id', id)
    .maybeSingle();
  if (readErr) {
    return NextResponse.json({ error: readErr.message }, { status: 500 });
  }
  if (!current) {
    return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
  }

  const now = new Date().toISOString();
  const patch: {
    status?: Status;
    notes?: string | null;
    read_at?: string;
    responded_at?: string;
  } = {};

  if (status !== undefined) {
    patch.status = status;
    // First-touch timestamps: stamp once, never overwrite.
    if (status !== 'new' && !current.read_at) patch.read_at = now;
    if (status === 'responded' && !current.responded_at) patch.responded_at = now;
  }
  if (notes !== undefined) {
    patch.notes = notes && notes.trim().length > 0 ? notes : null;
  }

  const { data: updated, error: updErr } = await supabase
    .from('contact_submissions')
    .update(patch)
    .eq('id', id)
    .select(SELECT_COLUMNS)
    .maybeSingle();
  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  await writeAudit(supabase, {
    adminId: session.user.id,
    action: 'update',
    entityType: 'contact_submission',
    entityId: id,
    metadata: {
      status_from: current.status,
      status_to: status ?? current.status,
      notes_changed: notes !== undefined,
    },
  });

  return NextResponse.json({ row: updated });
}

export const PATCH = handleMutation;
// Backwards-compatible alias, matching the other admin routes.
export const POST = handleMutation;
