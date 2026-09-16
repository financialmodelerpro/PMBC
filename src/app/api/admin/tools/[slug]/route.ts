import { NextResponse } from 'next/server';
import { z } from 'zod';

import { findTool } from '@/config/tools';
import { writeAudit } from '@/lib/audit';
import { requireOwner } from '@/lib/auth/requireAdmin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { TOOL_VISIBILITY_AUDIT } from '@/lib/tools/admin';
import { isMissingSchema, toolsDb } from '@/lib/tools/db';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({ status: z.enum(['hidden', 'live']) });

/**
 * Switches one tool Hidden or Live.
 *
 * Admin only. Going Live publishes a page, a footer link, a service page CTA
 * and a sitemap entry in one move, which is the kind of site-wide change the
 * editor role is kept away from elsewhere (Site Settings, Footer Links).
 *
 * A draft tool cannot be switched Live. Every change writes an audit entry with
 * the old and new status, which is the visibility history on /admin/tools/[slug].
 */
export async function PATCH(req: Request, props: { params: Promise<{ slug: string }> }) {
  const session = await requireOwner();
  if (session instanceof NextResponse) return session;

  const { slug } = await props.params;
  const tool = findTool(slug);
  if (!tool) return NextResponse.json({ error: 'Unknown tool' }, { status: 404 });

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'Status must be hidden or live' }, { status: 422 });
  const status = parsed.data.status;

  if (status === 'live' && tool.build !== 'ready') {
    return NextResponse.json({ error: 'This tool is still in development and cannot be switched Live.' }, { status: 409 });
  }

  const db = toolsDb();
  const { data: before, error: readErr } = await db.from('tool_visibility').select('status').eq('slug', slug).maybeSingle();
  if (readErr) {
    return NextResponse.json(
      {
        error: isMissingSchema(readErr)
          ? 'The tool_visibility table does not exist. Apply migration 076 in the Supabase SQL editor.'
          : readErr.message,
      },
      { status: isMissingSchema(readErr) ? 409 : 500 },
    );
  }
  const from = (before as { status?: string } | null)?.status ?? 'hidden';

  const now = new Date().toISOString();
  const { error } = await db
    .from('tool_visibility')
    .upsert({ slug, status, updated_at: now, updated_by: session.user.id }, { onConflict: 'slug' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAudit(createSupabaseServerClient(), {
    adminId: session.user.id,
    action: TOOL_VISIBILITY_AUDIT.action,
    entityType: TOOL_VISIBILITY_AUDIT.entityType,
    entityId: slug,
    metadata: { from, to: status, tool: tool.name },
    beforeValue: { status: from },
    afterValue: { status },
  });

  return NextResponse.json({ ok: true, slug, status, from, updated_at: now });
}
