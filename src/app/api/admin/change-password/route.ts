import { NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getAdminSession } from '@/lib/auth/requireAdmin';
import { writeAudit } from '@/lib/audit';
import { MIN_PASSWORD_LENGTH, passwordProblem } from '@/lib/auth/password';

export const dynamic = 'force-dynamic';

/**
 * Cost 12, the same figure `rotate-admin-password.mjs` hashes at, so a password
 * set here and one set from the command line are indistinguishable in the row.
 */
const BCRYPT_COST = 12;

const schema = z.object({
  current_password: z.string().min(1, 'Enter your current password'),
  new_password: z.string().min(MIN_PASSWORD_LENGTH),
  confirm_password: z.string().min(1),
});

/**
 * Change the signed-in user's own password.
 *
 * Deliberately not part of the users API. This route acts on
 * `session.user.id` and never on an id from the request, so it cannot be
 * pointed at somebody else's row no matter what is posted, and an editor is
 * allowed to use it precisely because it can only reach their own account.
 *
 * **Nothing here logs the password.** Not the old one, not the new one, not its
 * length, and the audit row records that a change happened rather than what it
 * was. The failure paths return a message and no detail for the same reason.
 */
export async function POST(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
      { status: 400 },
    );
  }
  const { current_password, new_password, confirm_password } = parsed.data;

  if (new_password !== confirm_password) {
    return NextResponse.json({ error: 'The two new passwords do not match.' }, { status: 400 });
  }
  const problem = passwordProblem(new_password);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  if (new_password === current_password) {
    return NextResponse.json(
      { error: 'The new password must be different from the current one.' },
      { status: 400 },
    );
  }

  const supabase = createSupabaseServerClient();
  const { data: row, error } = await supabase
    .from('admin_users')
    .select('id, email, password_hash')
    .eq('id', session.user.id)
    .maybeSingle();

  if (error || !row) {
    return NextResponse.json({ error: 'Could not read your account.' }, { status: 500 });
  }

  const currentOk = await bcrypt.compare(current_password, row.password_hash);
  if (!currentOk) {
    // Audited as a failure, because repeated failures on a live console are
    // worth being able to see after the fact. The attempted value is not stored.
    await writeAudit(supabase, {
      adminId: session.user.id,
      action: 'password_change_failed',
      entityType: 'admin_users',
      entityId: session.user.id,
      metadata: { reason: 'current password did not match' },
    });
    return NextResponse.json({ error: 'Your current password is not correct.' }, { status: 400 });
  }

  const hash = await bcrypt.hash(new_password, BCRYPT_COST);
  const { error: updateError } = await supabase
    .from('admin_users')
    .update({ password_hash: hash })
    .eq('id', session.user.id);

  if (updateError) {
    return NextResponse.json({ error: 'Could not save the new password.' }, { status: 500 });
  }

  // Verify the stored hash actually matches what was set, the way the rotation
  // script does. A silent write failure here locks the account on next login.
  const { data: check } = await supabase
    .from('admin_users')
    .select('password_hash')
    .eq('id', session.user.id)
    .maybeSingle();
  if (!check || !(await bcrypt.compare(new_password, check.password_hash))) {
    return NextResponse.json(
      { error: 'The new password did not store correctly. Your old password still works.' },
      { status: 500 },
    );
  }

  await writeAudit(supabase, {
    adminId: session.user.id,
    action: 'password_change',
    entityType: 'admin_users',
    entityId: session.user.id,
    // No before/after: a password diff is the one diff that must never exist.
    metadata: { email: row.email },
  });

  return NextResponse.json({ ok: true });
}
