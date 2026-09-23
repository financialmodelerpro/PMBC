import { NextResponse } from 'next/server';

import { fail, ownerRequest } from '@/lib/growth/api';
import { handleChat, openingFor } from '@/lib/growth/chat';
import { chatRequestSchema } from '@/lib/growth/chatModel';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Ahmad's preview of the website chat: the same code as the public widget,
 * run as test conversations, working whether or not the widget is switched on
 * and in mock mode (labelled). No alert emails are sent for test conversations.
 */
export async function POST(req: Request) {
  const r = await ownerRequest(req, chatRequestSchema);
  if (!r.ok) return r.response;
  const result = await handleChat(r.data, { ipHash: null, userAgent: 'admin-preview', trackToken: null, preview: true });
  if (!result.ok) return fail(result.status, result.error);
  return NextResponse.json(result.value);
}

export async function GET(req: Request) {
  const r = await ownerRequest(req);
  if (!r.ok) return r.response;
  const path = new URL(req.url).searchParams.get('path') ?? '/';
  return NextResponse.json({ opening: await openingFor(/^\/[^\s]{0,300}$/.test(path) ? path : '/', null) });
}
