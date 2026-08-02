import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { z } from 'zod';

import { getAdminSession } from '@/lib/auth/requireAdmin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Database, Json } from '@/types/database';
import { forDiff, snapshotRow, writeAudit } from '@/lib/audit';
import { slugify } from '@/lib/admin/slugify';

type AnyRow = Record<string, unknown>;

// The collection table name is dynamic, so we operate through an untyped client
// for table access and cast back to the typed client only for writeAudit.
function looseDb(): SupabaseClient {
  return createSupabaseServerClient() as unknown as SupabaseClient;
}
function typed(db: SupabaseClient): SupabaseClient<Database> {
  return db as unknown as SupabaseClient<Database>;
}

/**
 * Context handed to `transformWrite`. `before` is the row as it existed prior
 * to the write, and is always null on create. It lets a transform tell an
 * actual state change from a no-op re-save, which matters for anything that
 * stamps a timestamp on transition.
 */
export type WriteContext = {
  mode: 'create' | 'update';
  before: AnyRow | null;
};

type CollectionConfig = {
  /** Postgres table name. */
  table: string;
  /** Columns returned by GET. Defaults to '*'. */
  selectColumns?: string;
  /** Ordering for list GET. */
  orderBy?: { column: string; ascending: boolean };
  /** zod schema validating the POST (create) body. */
  createSchema: z.ZodTypeAny;
  /** zod schema validating the PATCH (update) body; must allow an `id`. */
  updateSchema: z.ZodTypeAny;
  /** If set, a slug is auto-derived from `titleField` when absent/blank. */
  slugField?: string;
  titleField?: string;
  /** Stamp updated_at on write. Defaults true. */
  touchUpdatedAt?: boolean;
  /**
   * Last-mile shaping of the row about to be written, applied after zod
   * validation. Use it for values the server owns and the client must not be
   * able to set directly, such as a transition timestamp. Runs for both create
   * and update; the mode and the pre-write row are in the context.
   */
  transformWrite?: (row: AnyRow, ctx: WriteContext) => AnyRow;
  /**
   * Rejects a write before it reaches Postgres. Return an error string to fail
   * with a 403, or null to allow. Runs after `transformWrite`, so it sees the
   * row exactly as it would be written. Only called on update, where a
   * pre-existing row can carry a constraint the client should not override.
   */
  guardWrite?: (row: AnyRow, ctx: WriteContext) => string | null;
  /**
   * Rejects a delete before it reaches Postgres. Return an error string to fail
   * with a 403, or null to allow. Pairs with `guardWrite`: a row the admin is
   * forbidden to hide should not be removable by the other door either.
   */
  guardDelete?: (before: AnyRow | null) => string | null;
};

/**
 * Builds the standard admin CRUD handlers for a managed collection table.
 * Every handler is session-gated and audit-logged. Contract:
 *   GET            -> { rows }     (list, admin sees all statuses)
 *   GET ?id=       -> { row }      (single)
 *   POST           -> { row }      (create)
 *   PATCH {id,...} -> { row }      (update)
 *   DELETE ?id=    -> { ok: true } (delete)
 */
export function createCollectionApi(config: CollectionConfig) {
  const {
    table,
    selectColumns = '*',
    orderBy,
    createSchema,
    updateSchema,
    slugField,
    titleField,
    touchUpdatedAt = true,
    transformWrite,
    guardWrite,
    guardDelete,
  } = config;

  async function GET(req: Request) {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = looseDb();
    const id = new URL(req.url).searchParams.get('id');

    if (id) {
      const { data, error } = await supabase
        .from(table)
        .select(selectColumns)
        .eq('id', id)
        .maybeSingle();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ row: data });
    }

    let query = supabase.from(table).select(selectColumns);
    if (orderBy) query = query.order(orderBy.column, { ascending: orderBy.ascending });
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ rows: data ?? [] });
  }

  async function POST(req: Request) {
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
        { error: 'Validation failed', issues: parsed.error.issues },
        { status: 422 },
      );
    }

    let row = { ...(parsed.data as AnyRow) };
    if (transformWrite) row = transformWrite(row, { mode: 'create', before: null });
    if (slugField && titleField) {
      const slug = row[slugField];
      if (!slug || (typeof slug === 'string' && slug.trim() === '')) {
        row[slugField] = slugify(String(row[titleField] ?? '') || 'untitled');
      } else if (typeof slug === 'string') {
        row[slugField] = slugify(slug);
      }
    }
    if (touchUpdatedAt) row.updated_at = new Date().toISOString();

    const supabase = looseDb();
    const { data, error } = await supabase
      .from(table)
      .insert(row as never)
      .select(selectColumns)
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await writeAudit(typed(supabase), {
      adminId: session.user.id,
      action: 'create',
      entityType: table,
      entityId: (data as unknown as AnyRow | null)?.id
        ? String((data as unknown as AnyRow).id)
        : null,
      // A create has nothing before it, so the null is meaningful rather than
      // a gap in the record.
      beforeValue: null,
      afterValue: forDiff(data as unknown as Json),
    });

    return NextResponse.json({ row: data });
  }

  async function PATCH(req: Request) {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const parsed = updateSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: parsed.error.issues },
        { status: 422 },
      );
    }

    const { id, ...rest } = parsed.data as AnyRow & { id: string };
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const supabase = looseDb();
    // Snapshot first: after the update the old values are gone. snapshotRow
    // returns null on any failure, so a missed snapshot costs the diff and
    // never the mutation. It is read before the patch is shaped because
    // transformWrite and guardWrite both need the pre-write state.
    const before = await snapshotRow(typed(supabase), table, 'id', String(id));
    const beforeRow = (before as unknown as AnyRow | null) ?? null;

    let patch = { ...rest } as AnyRow;
    if (transformWrite) {
      patch = transformWrite(patch, { mode: 'update', before: beforeRow });
    }
    if (guardWrite) {
      const refusal = guardWrite(patch, { mode: 'update', before: beforeRow });
      if (refusal) return NextResponse.json({ error: refusal }, { status: 403 });
    }
    if (slugField && typeof patch[slugField] === 'string' && patch[slugField]) {
      patch[slugField] = slugify(String(patch[slugField]));
    }
    if (touchUpdatedAt) patch.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from(table)
      .update(patch as never)
      .eq('id', id)
      .select(selectColumns)
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await writeAudit(typed(supabase), {
      adminId: session.user.id,
      action: 'update',
      entityType: table,
      entityId: String(id),
      beforeValue: forDiff(before),
      afterValue: forDiff(data as unknown as Json),
    });

    return NextResponse.json({ row: data });
  }

  async function DELETE(req: Request) {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const supabase = looseDb();
    // The whole point of auditing a delete is keeping what was removed.
    const before = await snapshotRow(typed(supabase), table, 'id', id);

    if (guardDelete) {
      const refusal = guardDelete((before as unknown as AnyRow | null) ?? null);
      if (refusal) return NextResponse.json({ error: refusal }, { status: 403 });
    }

    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await writeAudit(typed(supabase), {
      adminId: session.user.id,
      action: 'delete',
      entityType: table,
      entityId: id,
      beforeValue: forDiff(before),
      afterValue: null,
    });

    return NextResponse.json({ ok: true });
  }

  return { GET, POST, PATCH, DELETE };
}
