/**
 * Shared plumbing for the Growth admin API routes (from Phase 2, 2026-09-23).
 * Server only.
 *
 * Every Growth API route is admin-only: `ownerRequest` calls `requireOwner`
 * (401 without a session, 403 for an editor) before anything else, then
 * parses the JSON body with the route's zod schema. Errors are
 * `{ error: string, code?: string }` with a non-2xx status, and every
 * successful change writes an `audit_log` row through `auditGrowth`.
 */

import { NextResponse } from 'next/server';
import type { z } from 'zod';

import { writeAudit } from '@/lib/audit';
import { requireOwner } from '@/lib/auth/requireAdmin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Json } from '@/types/database';

import type { Actor } from './kb';

export type OwnerRequest<T> = { ok: true; data: T; actor: Actor; adminId: string } | { ok: false; response: NextResponse };

export function fail(status: number, error: string, code?: string): NextResponse {
  return NextResponse.json(code ? { error, code } : { error }, { status });
}

/** The owner gate, then the body parsed by `schema`. Pass no schema for a route with no body. */
export async function ownerRequest<S extends z.ZodTypeAny>(req: Request, schema?: S): Promise<OwnerRequest<z.infer<S>>> {
  const gate = await requireOwner();
  if (gate instanceof NextResponse) return { ok: false, response: gate };
  const actor = { id: gate.user.id, name: gate.user.name || gate.user.email };
  if (!schema) return { ok: true, data: undefined as z.infer<S>, actor, adminId: gate.user.id };
  let json: unknown;
  try {
    const text = await req.text();
    json = text ? JSON.parse(text) : {};
  } catch {
    return { ok: false, response: fail(400, 'Invalid JSON') };
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path?.length ? `${issue.path.join('.')}: ` : '';
    return { ok: false, response: fail(422, `${where}${issue?.message ?? 'Validation failed'}`) };
  }
  return { ok: true, data: parsed.data, actor, adminId: gate.user.id };
}

/** One audit_log row for a Growth change. Never throws. */
export async function auditGrowth(adminId: string, action: string, entityType: string, entityId: string | null, afterValue?: unknown, beforeValue?: unknown): Promise<void> {
  try {
    await writeAudit(createSupabaseServerClient(), {
      adminId,
      action,
      entityType,
      entityId,
      afterValue: (afterValue ?? null) as Json,
      beforeValue: (beforeValue ?? null) as Json,
    });
  } catch {
    // writeAudit already swallows its own errors; this guards the client constructor.
  }
}

/** A write result shared by the Growth data modules. */
export type WriteResult<T> = { ok: true; value: T } | { ok: false; status: number; error: string; code?: string };

export function respond<T>(result: WriteResult<T>, key: string): NextResponse {
  if (!result.ok) return fail(result.status, result.error, result.code);
  return NextResponse.json({ [key]: result.value });
}
