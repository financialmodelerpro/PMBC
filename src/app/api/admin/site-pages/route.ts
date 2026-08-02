import { z } from 'zod';

import { createCollectionApi } from '@/lib/admin/collectionApi';

const base = {
  label: z.string().min(1).max(80),
  href: z.string().min(1).max(300),
  display_order: z.number().int().optional(),
  visible: z.boolean().optional(),
  can_toggle: z.boolean().optional(),
};

const api = createCollectionApi({
  table: 'site_pages',
  orderBy: { column: 'display_order', ascending: true },
  createSchema: z.object(base),
  updateSchema: z.object({
    ...base,
    id: z.string().uuid(),
    label: z.string().min(1).max(80).optional(),
    href: z.string().min(1).max(300).optional(),
  }),
  /**
   * A pinned item (can_toggle false, migration 033) stays in the navbar. The
   * admin table already locks the Visible switch, but the rule is enforced here
   * because the client is not the authority on it: anyone can PATCH the route
   * directly. Same reasoning as the is_system page-delete guard in parity 5.
   *
   * Only an actual change is refused. Saving a pinned row's label sends
   * `visible` back unchanged, and that must keep working.
   */
  guardWrite: (patch, { before }) => {
    if (!before || before.can_toggle !== false) return null;
    if ('visible' in patch && patch.visible !== before.visible) {
      return 'This navigation item is pinned and cannot be hidden.';
    }
    return null;
  },
  /**
   * Deleting a pinned item would reach the same end state as hiding it, so the
   * two are refused together. A pin that only blocks one of the two doors is
   * not a pin.
   */
  guardDelete: (before) => {
    if (before && before.can_toggle === false) {
      return 'This navigation item is pinned and cannot be deleted. Unpin it first.';
    }
    return null;
  },
});

export const { GET } = api;

/**
 * Rebuilds a Request around an already-consumed body. A Request body can only
 * be read once, so the retry below needs a fresh one.
 */
function reqWith(req: Request, body: string): Request {
  return new Request(req.url, {
    method: req.method,
    headers: req.headers,
    body,
  });
}

/**
 * Runs a write, and retries it without `can_toggle` if Postgres rejects the
 * column.
 *
 * Migration 033 is DDL, which supabase-js cannot execute, so it is applied by
 * hand like 031 and 032. Until it runs, the column does not exist and any write
 * carrying it fails with "Could not find the 'can_toggle' column". Rather than
 * breaking Pages and Nav on an un-migrated database, the write is replayed with
 * the field dropped: the admin loses pinning, not the ability to edit the
 * navbar.
 *
 * Deliberately narrow. It only retries a 500 whose error names the column, so a
 * 403 from guardWrite and a 422 from zod both pass straight through.
 */
async function writeWithCanToggleFallback(
  req: Request,
  handler: (r: Request) => Promise<Response>,
): Promise<Response> {
  const raw = await req.text();
  const res = await handler(reqWith(req, raw));
  if (res.status !== 500) return res;

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return res;
  }
  if (!('can_toggle' in body)) return res;

  let message = '';
  try {
    const json = (await res.clone().json()) as { error?: unknown };
    message = typeof json.error === 'string' ? json.error : '';
  } catch {
    return res;
  }
  if (!message.includes('can_toggle')) return res;

  const stripped = { ...body };
  delete stripped.can_toggle;
  return handler(reqWith(req, JSON.stringify(stripped)));
}

export async function POST(req: Request) {
  return writeWithCanToggleFallback(req, api.POST);
}

export async function PATCH(req: Request) {
  return writeWithCanToggleFallback(req, api.PATCH);
}

export const { DELETE } = api;
