/**
 * /api/admin/testimonials
 *
 * Simplified from the FMP original, which merged two sources (manual
 * testimonials plus student testimonials) and carried a `hub` column to say
 * whether a quote belonged to the Training or Modeling side. Neither concept
 * exists here, so this reads and writes one plain table.
 *
 * No em dashes in this file.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/src/core/db/supabase';
import { isAdminRequest } from '@/src/shared/auth/adminAuth';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!await isAdminRequest()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const sb = getServerClient();
  const { data, error } = await sb.from('testimonials').select('*').order('display_order').order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ testimonials: data ?? [] });
}

export async function POST(req: NextRequest) {
  if (!await isAdminRequest()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body?.text || !body?.name) {
    return NextResponse.json({ error: 'text and name are required.' }, { status: 400 });
  }
  const sb = getServerClient();
  const { data, error } = await sb.from('testimonials').insert({
    text: body.text,
    name: body.name,
    role: body.role ?? '',
    company: body.company ?? '',
    rating: typeof body.rating === 'number' ? body.rating : null,
    is_featured: body.is_featured === true,
    status: body.status ?? 'approved',
    display_order: typeof body.display_order === 'number' ? body.display_order : 0,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ testimonial: data });
}

export async function PATCH(req: NextRequest) {
  if (!await isAdminRequest()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body?.id) return NextResponse.json({ error: 'id is required.' }, { status: 400 });

  const { id, ...rest } = body;
  // Whitelist the editable columns: never spread a request body into an update.
  const ALLOWED = ['text', 'name', 'role', 'company', 'rating', 'is_featured', 'status', 'display_order'];
  const update: Record<string, unknown> = {};
  for (const k of ALLOWED) if (rest[k] !== undefined) update[k] = rest[k];
  if (Object.keys(update).length === 0) return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });

  const sb = getServerClient();
  const { error } = await sb.from('testimonials').update(update).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!await isAdminRequest()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required.' }, { status: 400 });
  const sb = getServerClient();
  const { error } = await sb.from('testimonials').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
