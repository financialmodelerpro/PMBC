import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireOwner } from '@/lib/auth/requireAdmin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { writeAudit } from '@/lib/audit';
import {
  footerLinksSchema,
  parseFooterLinks,
  serializeFooterLinks,
} from '@/lib/cms/footerLinks';

/**
 * The footer's navigation links, stored as one JSON array in `cms_content`
 * under `(footer_settings, links)`.
 *
 * A whole-list write rather than the per-row PATCH that /api/admin/site-pages
 * offers, because the list is one row: see the note at the top of
 * lib/cms/footerLinks.ts for why it is a row and not a table. The admin table
 * keeps the per-row save model regardless; it just sends the whole list each
 * time, so the last write wins. With one admin that is the correct behaviour
 * and not a compromise.
 */

const SECTION = 'footer_settings';
const KEY = 'links';

const bodySchema = z.object({ links: footerLinksSchema });

export async function GET() {
  const gate = await requireOwner();
  if (gate instanceof NextResponse) return gate;
  const session = gate;

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('cms_content')
    .select('value')
    .eq('section', SECTION)
    .eq('key', KEY)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Falls back to the shipped list when the key has never been written, so a
  // database that has not had the seed run still opens on a usable table rather
  // than an empty one the operator would have to rebuild by hand.
  return NextResponse.json({ links: parseFooterLinks(data?.value ?? null) });
}

async function handleMutation(req: Request) {
  const gate = await requireOwner();
  if (gate instanceof NextResponse) return gate;
  const session = gate;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 422 },
    );
  }

  const links = parsed.data.links;

  // Two links sharing an id would make the admin table edit the wrong row, and
  // the id is generated client side, so it is checked here rather than assumed.
  const ids = new Set(links.map((l) => l.id));
  if (ids.size !== links.length) {
    return NextResponse.json({ error: 'Two links share the same id' }, { status: 422 });
  }

  const supabase = createSupabaseServerClient();
  const { data: before } = await supabase
    .from('cms_content')
    .select('value')
    .eq('section', SECTION)
    .eq('key', KEY)
    .maybeSingle();

  const value = serializeFooterLinks(links);
  const { error } = await supabase
    .from('cms_content')
    .upsert(
      { section: SECTION, key: KEY, value, updated_at: new Date().toISOString() },
      { onConflict: 'section,key' },
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await writeAudit(supabase, {
    adminId: session.user.id,
    action: 'update',
    entityType: 'footer_links',
    entityId: KEY,
    metadata: {
      count: links.length,
      hidden: links.filter((l) => !l.visible).map((l) => l.label),
    },
    beforeValue: { links: parseFooterLinks(before?.value ?? null) },
    afterValue: { links },
  });

  return NextResponse.json({ links });
}

export const PATCH = handleMutation;
export const POST = handleMutation;
