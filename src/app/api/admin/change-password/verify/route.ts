import { NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getAdminSession } from '@/lib/auth/requireAdmin';
import { writeAudit } from '@/lib/audit';
import { verifyCode, clearPendingChange } from '@/lib/auth/passwordCodes';

export const dynamic = 'force-dynamic';

const schema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^[0-9]{6}$/, 'Enter the six-digit code from the email'),
});

/**
 * Step two: the code from the email, and the change is applied.
 *
 * Acts on `session.user.id` only, like step one, so a code cannot be used
 * against another account even if one were somehow obtained.
 *
 * The password hash applied here was computed in step one and parked with the
 * code. Nothing between the two steps holds a plaintext password, which is the
 * reason it was hashed before being stored rather than after being confirmed.
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

  const result = await verifyCode(session.user.id, parsed.data.code);

  if (result.state === 'none') {
    return NextResponse.json(
      { error: 'There is no change waiting. Start again.', restart: true },
      { status: 400 },
    );
  }
  if (result.state === 'expired') {
    return NextResponse.json(
      { error: 'That code has expired. Start again to get a new one.', restart: true },
      { status: 400 },
    );
  }
  if (result.state === 'exhausted') {
    await writeAudit(createSupabaseServerClient(), {
      adminId: session.user.id,
      action: 'password_change_failed',
      entityType: 'admin_users',
      entityId: session.user.id,
      metadata: { reason: 'too many wrong codes, the pending change was discarded' },
    });
    return NextResponse.json(
      {
        error: 'Too many wrong codes. The change has been discarded and your password is unchanged.',
        restart: true,
      },
      { status: 400 },
    );
  }
  if (result.state === 'wrong') {
    return NextResponse.json(
      {
        error: `That code is not right. ${result.attemptsLeft} ${
          result.attemptsLeft === 1 ? 'attempt' : 'attempts'
        } left.`,
      },
      { status: 400 },
    );
  }

  const supabase = createSupabaseServerClient();
  const { error: updateError } = await supabase
    .from('admin_users')
    .update({ password_hash: result.newPasswordHash })
    .eq('id', session.user.id);

  if (updateError) {
    return NextResponse.json(
      { error: 'Could not save the new password. Your old password still works.', restart: true },
      { status: 500 },
    );
  }

  // Read back what was stored, as the rotation script does. A silent write
  // failure here would lock the account on the next login.
  const { data: check } = await supabase
    .from('admin_users')
    .select('password_hash, email')
    .eq('id', session.user.id)
    .maybeSingle();
  if (!check || check.password_hash !== result.newPasswordHash) {
    await clearPendingChange(session.user.id);
    return NextResponse.json(
      { error: 'The new password did not store correctly. Your old password still works.', restart: true },
      { status: 500 },
    );
  }

  await writeAudit(supabase, {
    adminId: session.user.id,
    action: 'password_change',
    entityType: 'admin_users',
    entityId: session.user.id,
    // No before/after: a password diff is the one diff that must never exist.
    metadata: { email: check.email, confirmed_by_email: true },
  });

  return NextResponse.json({ ok: true });
}
