import { NextResponse } from 'next/server';

import { handleBrevoEvent } from '@/lib/growth/nurture';
import { extractToken, tokenMatches } from '@/lib/tools/webhook';

export const dynamic = 'force-dynamic';

/**
 * Brevo events for Growth email (Unit 6.2, 2026-09-23): opens, clicks,
 * unsubscribes, bounces and complaints. Separate from the free tools webhook.
 * Refuses everything without GROWTH_BREVO_WEBHOOK_TOKEN, or with the wrong
 * token (query `token` or `Authorization: Bearer`). Each event is applied once.
 */
export async function POST(req: Request) {
  const expected = process.env.GROWTH_BREVO_WEBHOOK_TOKEN;
  if (!expected) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  if (!tokenMatches(extractToken(new URL(req.url), req.headers.get('authorization')), expected)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const events = (Array.isArray(body) ? body : [body]).filter((e): e is Record<string, unknown> => Boolean(e) && typeof e === 'object').slice(0, 500);
  const counts = { applied: 0, duplicate: 0, ignored: 0 };
  for (const ev of events) {
    try {
      counts[await handleBrevoEvent(ev)]++;
    } catch (err) {
      console.error('[growth-brevo] event not applied:', err instanceof Error ? err.message : err);
      counts.ignored++;
    }
  }
  return NextResponse.json({ ok: true, ...counts });
}
