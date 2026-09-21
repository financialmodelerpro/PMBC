/**
 * The daily reminder run (since 2026-09-21), called by the Vercel cron route. Reads the last 30 days
 * of real leads (test leads never get reminders), groups them by email, and sends each person's due
 * reminder (`dueReminder`). Each send is claimed first by an event whose `dedupe_key` is unique per
 * email and reminder number, so two overlapping runs cannot send it twice; a failed send releases the
 * claim, so the next day's run tries again.
 */

import { sendEmail } from '@/lib/email/send';
import { baseLayoutBranded } from '@/lib/email/templates/_base';

import { toolsDb, type ToolLeadRow } from '../db';
import { buildReminderEmail } from '../email/templates';
import { headline } from '../valuation/format';
import { reviveResult } from '../valuation/serialize';
import { bookingLinkFor } from './bookingLinkStore';
import { BOOKED_EVENT, REMINDER_EVENT, REMINDER_TAG, UNSUBSCRIBED_EVENT, dueReminder, reminderDedupeKey, unsubscribeHref, type ReminderPerson } from './reminders';
import { resumeLinkForLead } from './resumeLinks';
import { insertLeadEvent } from './store';

type Row = Pick<ToolLeadRow, 'id' | 'created_at' | 'email' | 'name' | 'company' | 'follow_up_consent' | 'tool_slug' | 'is_test' | 'access_token' | 'results'>;

export type ReminderRunSummary = { people: number; due: number; sent: number; failed: number; skipped: number };

export async function runReminders(now = new Date()): Promise<ReminderRunSummary> {
  const since = new Date(now.getTime() - 30 * 86_400_000).toISOString();
  const { data, error } = await toolsDb()
    .from('tool_leads')
    .select('id, created_at, email, name, company, follow_up_consent, tool_slug, is_test, access_token, results')
    .eq('is_test', false)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(5000);
  if (error) throw new Error(`reminder read failed: ${error.message}`);
  const rows = (data ?? []) as Row[];

  const ids = rows.map((r) => r.id);
  const events: { lead_id: string; event_type: string; dedupe_key: string | null }[] = [];
  for (let k = 0; k < ids.length; k += 200) {
    const { data: ev } = await toolsDb()
      .from('tool_lead_events')
      .select('lead_id, event_type, dedupe_key')
      .in('lead_id', ids.slice(k, k + 200))
      .in('event_type', [REMINDER_EVENT, UNSUBSCRIBED_EVENT, BOOKED_EVENT]);
    events.push(...((ev ?? []) as typeof events));
  }

  const byEmail = new Map<string, Row[]>();
  for (const r of rows) {
    const key = r.email.trim().toLowerCase();
    byEmail.set(key, [...(byEmail.get(key) ?? []), r]);
  }

  const summary: ReminderRunSummary = { people: byEmail.size, due: 0, sent: 0, failed: 0, skipped: 0 };
  for (const [email, list] of byEmail) {
    const latest = list[0];
    const mine = new Set(list.map((r) => r.id));
    const own = events.filter((e) => mine.has(e.lead_id));
    const person: ReminderPerson = {
      email,
      name: latest.name,
      latestLeadId: latest.id,
      latestAt: latest.created_at,
      latestCompany: latest.company,
      toolSlug: latest.tool_slug,
      followUp: latest.follow_up_consent,
      unsubscribed: own.some((e) => e.event_type === UNSUBSCRIBED_EVENT),
      booked: own.some((e) => e.event_type === BOOKED_EVENT),
      sent: [1, 2].filter((n) => own.some((e) => e.event_type === REMINDER_EVENT && e.dedupe_key === reminderDedupeKey(email, n))),
    };
    const n = dueReminder(person, now);
    if (!n) continue;
    summary.due++;

    const key = reminderDedupeKey(email, n);
    const claim = await insertLeadEvent({ lead_id: latest.id, event_type: REMINDER_EVENT, source: 'system', dedupe_key: key, detail: `Reminder ${n} of 2, day ${n === 1 ? 7 : 14}.`, payload: { n } });
    if (claim !== 'inserted') {
      summary.skipped++;
      continue;
    }

    let range: string | null = null;
    try {
      range = headline(reviveResult(latest.results)).equityRange;
    } catch {
      range = null;
    }
    const { subject, body } = buildReminderEmail({
      n,
      name: latest.name,
      company: latest.company,
      equityRange: range,
      bookingHref: await bookingLinkFor(latest, 'email'),
      resumeHref: await resumeLinkForLead(latest),
      unsubscribeHref: unsubscribeHref(email),
    });
    const unsub = unsubscribeHref(email);
    const sent = await sendEmail({
      to: latest.email,
      subject,
      html: await baseLayoutBranded(body, { variant: 'report' }),
      from: process.env.EMAIL_FROM_CONTACT || undefined,
      tags: [REMINDER_TAG, latest.tool_slug, `reminder-${n}`],
      headers: {
        'X-Mailin-custom': `lead:${latest.id}|kind:reminder`,
        // One-click unsubscribe for mail providers (RFC 8058): a POST, never a link a scanner follows.
        'List-Unsubscribe': `<${unsub}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    });
    if (sent.ok) {
      summary.sent++;
    } else {
      summary.failed++;
      // Release the claim so tomorrow's run tries again, inside the reminder's window.
      await toolsDb().from('tool_lead_events').delete().eq('dedupe_key', key);
      console.error('[tool-reminders] send failed', email, n, sent);
    }
  }
  return summary;
}
