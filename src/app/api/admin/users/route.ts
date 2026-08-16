import { NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireOwner } from '@/lib/auth/requireAdmin';
import { writeAudit } from '@/lib/audit';
import { MIN_PASSWORD_LENGTH, passwordProblem } from '@/lib/auth/password';

export const dynamic = 'force-dynamic';

const BCRYPT_COST = 12;

const createSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address').max(200),
  name: z.string().trim().min(1, 'Enter a name').max(120),
  role: z.enum(['admin', 'editor']),
  password: z.string().min(MIN_PASSWORD_LENGTH),
});

const patchSchema = z.object({
  id: z.string().uuid(),
  role: z.enum(['admin', 'editor']),
});

/**
 * User management, admin only throughout.
 *
 * Every handler here gates on `requireOwner`, so an editor cannot list the
 * console's users, let alone create one or change a role. That is the whole
 * reason this is a separate route from `/api/admin/change-password`, which acts
 * only on the caller's own row and is therefore open to both roles.
 *
 * **Password hashes never leave this file.** The list select names its columns
 * rather than using `*`, so a hash cannot reach the browser through a column
 * added later.
 */
export async function GET() {
  const gate = await requireOwner();
  if (gate instanceof NextResponse) return gate;
  const session = gate;

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('admin_users')
    .select('id, email, name, role, created_at, last_login_at')
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data ?? [], currentUserId: session.user.id });
}

export async function POST(req: Request) {
  const gate = await requireOwner();
  if (gate instanceof NextResponse) return gate;
  const session = gate;

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
  const { email, name, role, password } = parsed.data;

  const problem = passwordProblem(password);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  const supabase = createSupabaseServerClient();
  const { data: existing } = await supabase
    .from('admin_users')
    .select('id')
    .eq('email', email)
    .maybeSingle();
  if (existing) {
    return NextResponse.json(
      { error: 'A user with that email already exists.' },
      { status: 409 },
    );
  }

  const password_hash = await bcrypt.hash(password, BCRYPT_COST);
  const { data: created, error } = await supabase
    .from('admin_users')
    .insert({ email, name, role, password_hash })
    .select('id, email, name, role, created_at, last_login_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAudit(supabase, {
    adminId: session.user.id,
    action: 'create',
    entityType: 'admin_users',
    entityId: created.id,
    // Role and email, never the password or its hash.
    afterValue: { email: created.email, name: created.name, role: created.role },
  });

  return NextResponse.json({ row: created });
}

/** Change a role. The only field that can be patched, deliberately. */
export async function PATCH(req: Request) {
  const gate = await requireOwner();
  if (gate instanceof NextResponse) return gate;
  const session = gate;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const { id, role } = parsed.data;

  const supabase = createSupabaseServerClient();
  const { data: before } = await supabase
    .from('admin_users')
    .select('id, email, name, role')
    .eq('id', id)
    .maybeSingle();
  if (!before) return NextResponse.json({ error: 'No such user.' }, { status: 404 });

  // Demoting yourself would take away the screen you are standing on, and if
  // you are the only admin it would leave the console with nobody who can
  // promote anyone back.
  if (id === session.user.id && role !== 'admin') {
    return NextResponse.json(
      { error: 'You cannot remove your own admin role. Ask another admin to do it.' },
      { status: 400 },
    );
  }
  if (before.role === 'admin' && role !== 'admin') {
    const { count } = await supabase
      .from('admin_users')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'admin');
    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        { error: 'That is the last admin. Promote someone else first.' },
        { status: 400 },
      );
    }
  }

  const { data: after, error } = await supabase
    .from('admin_users')
    .update({ role })
    .eq('id', id)
    .select('id, email, name, role, created_at, last_login_at')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAudit(supabase, {
    adminId: session.user.id,
    action: 'update',
    entityType: 'admin_users',
    entityId: id,
    beforeValue: { role: before.role },
    afterValue: { role: after.role },
  });

  return NextResponse.json({ row: after });
}

export async function DELETE(req: Request) {
  const gate = await requireOwner();
  if (gate instanceof NextResponse) return gate;
  const session = gate;

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const supabase = createSupabaseServerClient();
  const { data: before } = await supabase
    .from('admin_users')
    .select('id, email, name, role')
    .eq('id', id)
    .maybeSingle();
  if (!before) return NextResponse.json({ error: 'No such user.' }, { status: 404 });

  if (id === session.user.id) {
    return NextResponse.json(
      { error: 'You cannot remove your own account.' },
      { status: 400 },
    );
  }
  if (before.role === 'admin') {
    const { count } = await supabase
      .from('admin_users')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'admin');
    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        { error: 'That is the last admin. The console would have nobody who can manage it.' },
        { status: 400 },
      );
    }
  }

  // Detach their audit history before removing the row.
  //
  // `audit_log.admin_id` is a foreign key onto this table, so a user who has
  // ever done anything cannot be deleted while their entries point at them:
  // Postgres refuses, and the console would report a constraint error nobody
  // can act on. The entries themselves must survive, because an audit trail
  // that loses events when someone leaves is not an audit trail.
  //
  // So the events stay and the attribution moves: `admin_id` goes null, and the
  // deletion entry written below records who this was by name, email and role.
  // The trail therefore reads "these things happened, and this person, named
  // here, was removed on this date" rather than silently shortening.
  const { error: detachError } = await supabase
    .from('audit_log')
    .update({ admin_id: null })
    .eq('admin_id', id);
  if (detachError) {
    return NextResponse.json(
      { error: 'Could not detach their audit history, so the account was left in place.' },
      { status: 500 },
    );
  }

  const { error } = await supabase.from('admin_users').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAudit(supabase, {
    adminId: session.user.id,
    action: 'delete',
    entityType: 'admin_users',
    entityId: id,
    beforeValue: { email: before.email, name: before.name, role: before.role },
    afterValue: null,
    metadata: {
      note: 'Their audit entries were kept and detached from the deleted account.',
    },
  });

  return NextResponse.json({ ok: true });
}
