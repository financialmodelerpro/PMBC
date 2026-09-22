import { NextResponse } from 'next/server';
import { z } from 'zod';

import { writeAudit } from '@/lib/audit';
import { canDelete, forbidden, getAdminSession } from '@/lib/auth/requireAdmin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { DELETE_LIMIT, deleteToolLeads } from '@/lib/tools/leads/deleteLeads';
import type { Json } from '@/types/database';

export const dynamic = 'force-dynamic';

const bodySchema = z
  .object({
    /** Whole people: every valuation under each email. */
    emails: z.array(z.string().trim().min(3).max(320)).max(DELETE_LIMIT).optional(),
    /** Single valuations. */
    ids: z.array(z.string().uuid()).max(DELETE_LIMIT).optional(),
  })
  .refine((b) => (b.emails?.length ?? 0) + (b.ids?.length ?? 0) > 0, { message: 'Nothing to delete' });

/**
 * Deletes tool leads: whole people by email, single valuations by id, or both. Admins only, as every
 * other delete in the console. One audit row per valuation removed, holding the row as it was.
 */
export async function DELETE(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canDelete(session)) return forbidden('Editors cannot delete leads.');

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Validation failed' }, { status: 422 });

  let outcome;
  try {
    outcome = await deleteToolLeads(parsed.data);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Delete failed' }, { status: 500 });
  }

  const emails = new Set((parsed.data.emails ?? []).map((e) => e.trim().toLowerCase()));
  const supabase = createSupabaseServerClient();
  for (const row of outcome.deleted) {
    await writeAudit(supabase, {
      adminId: session.user.id,
      action: 'delete',
      entityType: 'tool_leads',
      entityId: row.id,
      beforeValue: row as unknown as Json,
      afterValue: null,
      metadata: {
        scope: emails.has(row.email.trim().toLowerCase()) ? 'person' : 'valuation',
        events_deleted: outcome.eventsDeleted[row.id] ?? 0,
        person_events_moved_to: outcome.carriedTo[row.id] ?? null,
      },
    });
  }

  const people = new Set(outcome.deleted.map((r) => r.email.trim().toLowerCase())).size;
  return NextResponse.json({ ok: true, deleted: outcome.deleted.length, people });
}
