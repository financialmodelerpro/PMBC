/**
 * /api/admin/instructors
 *
 * Article authors. The FMP original called these "instructors" because that
 * site teaches courses; here they are simply the people who write articles.
 * The table and route names are unchanged so the copied article editor and its
 * InstructorPicker work without modification.
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
  const { data, error } = await sb.from('instructors').select('*').order('is_default', { ascending: false }).order('name');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ instructors: data ?? [] });
}

export async function POST(req: NextRequest) {
  if (!await isAdminRequest()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body?.name) return NextResponse.json({ error: 'name is required.' }, { status: 400 });

  const sb = getServerClient();
  const { data, error } = await sb.from('instructors').insert({
    name: body.name,
    title: body.title ?? null,
    photo_url: body.photo_url ?? null,
    bio: body.bio ?? null,
    profile_url: body.profile_url ?? null,
    is_default: body.is_default === true,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ instructor: data });
}
