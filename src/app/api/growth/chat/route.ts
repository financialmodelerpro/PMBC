import { NextResponse } from 'next/server';

import { handleChat, openingFor, publicChatAvailable } from '@/lib/growth/chat';
import { chatRequestSchema } from '@/lib/growth/chatModel';
import { TRACK_COOKIE } from '@/lib/growth/links';
import { clientIp, hashIp } from '@/lib/tools/leads/request';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * The public website chat (Unit 4.1, 2026-09-23). Answers 404 unless the
 * chat is switched on in Growth Settings (off by default) and a real Anthropic
 * key is set, so nothing about it is reachable while it is off.
 */

const noStore = { 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' };

function cookie(req: Request, name: string): string | null {
  const raw = req.headers.get('cookie') ?? '';
  const m = raw.split(/;\s*/).find((c) => c.startsWith(`${name}=`));
  return m ? decodeURIComponent(m.slice(name.length + 1)) : null;
}

/** The opening line for a page, and whether the visitor came from an outreach email. */
export async function GET(req: Request) {
  if (!(await publicChatAvailable())) return NextResponse.json({ error: 'Not available' }, { status: 404, headers: noStore });
  const path = new URL(req.url).searchParams.get('path') ?? '/';
  const safe = /^\/[^\s]{0,300}$/.test(path) ? path : '/';
  return NextResponse.json({ opening: await openingFor(safe, cookie(req, TRACK_COOKIE)) }, { headers: noStore });
}

export async function POST(req: Request) {
  if (!(await publicChatAvailable())) return NextResponse.json({ error: 'Not available' }, { status: 404, headers: noStore });
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers: noStore });
  }
  const parsed = chatRequestSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 422, headers: noStore });
  const result = await handleChat(parsed.data, { ipHash: hashIp(clientIp(req.headers)), userAgent: req.headers.get('user-agent'), trackToken: cookie(req, TRACK_COOKIE), preview: false });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status, headers: noStore });
  return NextResponse.json(result.value, { headers: noStore });
}
