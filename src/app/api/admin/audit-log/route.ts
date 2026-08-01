import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

import { getAdminSession } from '@/lib/auth/requireAdmin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Paginated audit log reader for the admin AuditLogViewer.
 *
 * Matches FMP's contract (CMS_REFERENCE.md sections 5.4 and 6): returns
 * `{ entries, total }`, accepts `limit` and `offset`, and joins admin_users so
 * the viewer shows a name rather than a UUID.
 *
 * Read-only by design. There is no PATCH or DELETE: an audit log the admin
 * console can edit is not an audit log. Rows are written only by lib/audit.ts,
 * server side, as a side effect of a real mutation. The POST here returns
 * filter options and mutates nothing.
 *
 * Queries run through a loosely-typed client. The filter set is built
 * conditionally, which the generated Database types cannot express without a
 * pile of casts that obscure what the query actually does.
 */

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

const ROW_COLUMNS =
  'id, action, entity_type, entity_id, metadata, created_at, before_value, after_value, reason, admin_users(name, email)';
/** Pre-032 shape, used when the diff columns do not exist yet. */
const ROW_COLUMNS_LEGACY =
  'id, action, entity_type, entity_id, metadata, created_at, admin_users(name, email)';

type Filters = {
  adminId: string | null;
  actions: string[];
  fromDate: string | null;
  toDate: string | null;
};

function clampInt(raw: string | null, fallback: number, min: number, max: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

/** Accepts YYYY-MM-DD from the date inputs, or a full ISO timestamp. */
function toIso(raw: string | null, endOfDay = false): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return endOfDay ? `${trimmed}T23:59:59.999Z` : `${trimmed}T00:00:00.000Z`;
  }
  const d = new Date(trimmed);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function applyFilters(query: any, f: Filters): any {
  let q = query;
  if (f.adminId) q = q.eq('admin_id', f.adminId);
  if (f.actions.length === 1) q = q.eq('action', f.actions[0]);
  else if (f.actions.length > 1) q = q.in('action', f.actions);
  if (f.fromDate) q = q.gte('created_at', f.fromDate);
  if (f.toDate) q = q.lte('created_at', f.toDate);
  return q;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function GET(req: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const limit = clampInt(url.searchParams.get('limit'), DEFAULT_LIMIT, 1, MAX_LIMIT);
  const offset = clampInt(url.searchParams.get('offset'), 0, 0, Number.MAX_SAFE_INTEGER);

  const filters: Filters = {
    adminId: url.searchParams.get('admin_id')?.trim() || null,
    // Repeatable: ?action=create&action=delete
    actions: url.searchParams.getAll('action').filter(Boolean),
    fromDate: toIso(url.searchParams.get('from_date')),
    toDate: toIso(url.searchParams.get('to_date'), true),
  };

  const db = createSupabaseServerClient() as unknown as SupabaseClient;

  // Counted separately so `total` reflects the filters rather than the page,
  // which is what drives "Showing X to Y of Z".
  const { count, error: countError } = await applyFilters(
    db.from('audit_log').select('id', { count: 'exact', head: true }),
    filters,
  );
  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 });
  }

  const read = async (columns: string) =>
    applyFilters(db.from('audit_log').select(columns), filters)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

  let diffColumnsAvailable = true;
  let result = await read(ROW_COLUMNS);
  if (result.error) {
    // Most likely migration 032 has not been applied, so the diff columns do
    // not exist. Degrade to the legacy shape rather than showing an error page.
    diffColumnsAvailable = false;
    result = await read(ROW_COLUMNS_LEGACY);
    if (result.error) {
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    entries: result.data ?? [],
    total: count ?? 0,
    limit,
    offset,
    diffColumnsAvailable,
  });
}

/** Distinct admins and actions, so the viewer can populate its filter dropdowns. */
export async function POST() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createSupabaseServerClient();

  const [adminsRes, actionsRes] = await Promise.all([
    supabase.from('admin_users').select('id, name, email').order('name'),
    // Sampling recent rows is enough to fill a dropdown and avoids a
    // full-table distinct scan on every page load.
    supabase
      .from('audit_log')
      .select('action')
      .order('created_at', { ascending: false })
      .limit(1000),
  ]);

  const actions = Array.from(
    new Set((actionsRes.data ?? []).map((r) => r.action).filter(Boolean)),
  ).sort();

  return NextResponse.json({ admins: adminsRes.data ?? [], actions });
}
