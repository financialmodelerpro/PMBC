import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { z } from 'zod';

import { getAdminSession } from '@/lib/auth/requireAdmin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';
import { writeAudit } from '@/lib/audit';
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

    const row = { ...(parsed.data as AnyRow) };
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

    const patch = { ...rest } as AnyRow;
    if (slugField && typeof patch[slugField] === 'string' && patch[slugField]) {
      patch[slugField] = slugify(String(patch[slugField]));
    }
    if (touchUpdatedAt) patch.updated_at = new Date().toISOString();

    const supabase = looseDb();
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
    });

    return NextResponse.json({ row: data });
  }

  async function DELETE(req: Request) {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const supabase = looseDb();
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await writeAudit(typed(supabase), {
      adminId: session.user.id,
      action: 'delete',
      entityType: table,
      entityId: id,
    });

    return NextResponse.json({ ok: true });
  }

  return { GET, POST, PATCH, DELETE };
}
