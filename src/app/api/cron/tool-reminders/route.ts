import { NextResponse } from 'next/server';

import { runReminders } from '@/lib/tools/leads/runReminders';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * The daily follow-up reminder run (since 2026-09-21), called by Vercel Cron (`vercel.json`), which
 * sends `Authorization: Bearer <CRON_SECRET>`. Without CRON_SECRET set it refuses every request, so
 * nothing can trigger sends by calling it. Vercel runs cron on production deployments only.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  if (req.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const summary = await runReminders();
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    console.error('[tool-reminders] run failed:', err);
    return NextResponse.json({ error: 'Run failed' }, { status: 500 });
  }
}
