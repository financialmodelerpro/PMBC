import { NextResponse } from 'next/server';

import { toolsDb } from '@/lib/tools/db';
import { UNSUBSCRIBED_EVENT, emailFromParam, verifyUnsubscribe } from '@/lib/tools/leads/reminders';
import { insertLeadEvent } from '@/lib/tools/leads/store';

export const dynamic = 'force-dynamic';

/**
 * Unsubscribe from the follow-up reminders (since 2026-09-21). The link carries the email and a
 * signature over it (`unsubscribeHref`). GET shows a confirmation page with a button and changes
 * nothing, because mail security scanners open links; POST, from that button or from a mail
 * provider's one-click unsubscribe (RFC 8058), turns follow-up off on every valuation under the
 * email and records it, which stops the reminders.
 */

const page = (title: string, body: string, status = 200) =>
  new NextResponse(
    `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title></head>` +
      `<body style="margin:0;background:#F3F5F7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#1F2933;">` +
      `<main style="max-width:520px;margin:64px auto;background:#fff;border:1px solid #DCE1E6;padding:32px;">` +
      `<p style="margin:0 0 6px;font-size:12px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#2E8B3A;">PaceMakers Business Consultants</p>` +
      `<h1 style="margin:0 0 14px;font-family:Georgia,serif;font-size:24px;color:#153D64;">${title}</h1>${body}</main></body></html>`,
    { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' } },
  );

function checked(url: URL): string | null {
  const email = emailFromParam(url.searchParams.get('e'));
  const sig = url.searchParams.get('s') ?? '';
  return email && verifyUnsubscribe(email, sig) ? email : null;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const email = checked(url);
  if (!email) return page('Link not recognised', '<p style="font-size:15px;line-height:1.6;">This unsubscribe link is not valid. Reply to any of our emails and we will stop them for you.</p>', 400);
  const action = `/api/tools/unsubscribe?${url.searchParams.toString()}`;
  return page(
    'Stop the reminders?',
    `<p style="font-size:15px;line-height:1.6;">We will stop sending follow-up reminders about your valuation to <strong>${email.replace(/[<>&"]/g, '')}</strong>.</p>` +
      `<form method="post" action="${action.replace(/"/g, '&quot;')}"><button type="submit" style="margin-top:10px;background:#153D64;color:#fff;border:0;padding:12px 22px;font-size:14px;font-weight:600;cursor:pointer;">Unsubscribe</button></form>`,
  );
}

export async function POST(req: Request) {
  const email = checked(new URL(req.url));
  if (!email) return page('Link not recognised', '<p style="font-size:15px;line-height:1.6;">This unsubscribe link is not valid.</p>', 400);
  const { data } = await toolsDb().from('tool_leads').select('id').eq('email', email);
  const ids = ((data ?? []) as { id: string }[]).map((r) => r.id);
  if (ids.length) {
    await toolsDb().from('tool_leads').update({ follow_up_consent: false }).in('id', ids);
    for (const id of ids) {
      await insertLeadEvent({ lead_id: id, event_type: UNSUBSCRIBED_EVENT, source: 'system', dedupe_key: `${UNSUBSCRIBED_EVENT}:${id}`, detail: 'Unsubscribed from follow-up reminders.' });
    }
  }
  return page('You are unsubscribed', '<p style="font-size:15px;line-height:1.6;">We will not send you any more reminders about your valuation. You can still use your saved link to come back to it.</p>');
}
