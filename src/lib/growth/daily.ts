/**
 * The Growth Engine's one scheduled run (from Unit 2.6, 2026-09-23). Server only.
 *
 * Vercel Cron calls /api/cron/growth-daily once a day at 09:00 Riyadh time
 * (06:00 UTC, vercel.json). Each job runs on its own: one failing never stops
 * the others, and each reports what it did. Every job checks its own settings
 * and refuses rather than acting on a default.
 */

import { runSignalFeed } from './feed';
import { briefUpcoming, syncBookings } from './meetings';
import { runSequence, syncToBrevo } from './nurture';
import { remindCheckins } from './partners';
import { checkReplies, draftDueFollowUps, sendDue } from './outreach';

export type JobResult = { job: string; ok: boolean; detail: string };

type Job = { name: string; run: () => Promise<string> };

async function runJobs(jobs: Job[]): Promise<JobResult[]> {
  const out: JobResult[] = [];
  for (const j of jobs) {
    try {
      out.push({ job: j.name, ok: true, detail: await j.run() });
    } catch (err) {
      console.error(`[growth-daily] ${j.name} failed:`, err);
      out.push({ job: j.name, ok: false, detail: err instanceof Error ? err.message.slice(0, 300) : 'failed' });
    }
  }
  return out;
}

export async function runGrowthDaily(now: Date = new Date()): Promise<JobResult[]> {
  return runJobs([
    {
      name: 'signal-feed',
      run: async () => {
        const r = await runSignalFeed({ trigger: 'cron', now });
        return r.ok ? r.value.message : r.error;
      },
    },
    // Replies first, so a reply stops its follow-up before one is drafted or sent.
    { name: 'reply-check', run: () => checkReplies() },
    { name: 'follow-up-drafts', run: () => draftDueFollowUps(now) },
    { name: 'scheduled-sends', run: () => sendDue(now) },
    {
      name: 'bookings-sync',
      run: async () => {
        const r = await syncBookings({ now });
        return r.ok ? r.value.message : r.error;
      },
    },
    { name: 'meeting-briefs', run: () => briefUpcoming(now) },
    { name: 'nurture-sync', run: async () => (await syncToBrevo()).message },
    { name: 'nurture-sequence', run: async () => (await runSequence(now)).message },
    { name: 'partner-checkins', run: () => remindCheckins(now) },
  ]);
}
