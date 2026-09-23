import { NextResponse } from 'next/server';

import { runGrowthDaily } from '@/lib/growth/daily';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * The Growth Engine's daily run (from 2026-09-23), called by Vercel Cron
 * (`vercel.json`) with `Authorization: Bearer <CRON_SECRET>`. Without
 * CRON_SECRET it refuses every request, so nothing can trigger it from
 * outside. Each job checks its own settings, the AI budget and suppression.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  if (req.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const jobs = await runGrowthDaily();
  return NextResponse.json({ ok: jobs.every((j) => j.ok), jobs });
}
