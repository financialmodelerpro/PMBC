import { NextResponse } from 'next/server';

import { toolsDb, type EmailStatus } from '@/lib/tools/db';
import { insertLeadEvent } from '@/lib/tools/leads/store';
import { extractToken, handleBrevoWebhook, type WebhookLead, type WebhookStore } from '@/lib/tools/webhook';

export const dynamic = 'force-dynamic';

const COLUMNS = 'id, email_status, email_message_id, alert_message_id';

const store: WebhookStore = {
  async findLeadById(id) {
    const { data } = await toolsDb().from('tool_leads').select(COLUMNS).eq('id', id).maybeSingle();
    return (data as WebhookLead) ?? null;
  },
  async findLeadByMessageId(messageId) {
    const { data } = await toolsDb()
      .from('tool_leads')
      .select(COLUMNS)
      .or(`email_message_id.eq."${messageId.replace(/"/g, '')}",alert_message_id.eq."${messageId.replace(/"/g, '')}"`)
      .limit(1)
      .maybeSingle();
    if (!data) return null;
    const lead = data as WebhookLead;
    return { lead, kind: lead.alert_message_id === messageId ? 'alert' : 'results' };
  },
  insertEvent: (event) => insertLeadEvent(event),
  async updateLeadStatus(id, patch: { email_status: EmailStatus; email_last_event_at: string }) {
    await toolsDb().from('tool_leads').update(patch).eq('id', id);
  },
};

/**
 * Brevo transactional webhook. Configure in Brevo as
 * `https://www.pacemakersglobal.com/api/webhooks/brevo?token=<BREVO_WEBHOOK_TOKEN>`.
 * See `src/lib/tools/webhook.ts` for authentication, matching and status rules.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  try {
    const outcome = await handleBrevoWebhook(
      {
        token: extractToken(new URL(req.url), req.headers.get('authorization')),
        expectedToken: process.env.BREVO_WEBHOOK_TOKEN,
        body,
      },
      store,
    );
    return NextResponse.json(outcome.body, { status: outcome.status });
  } catch (err) {
    // A database fault. 500 makes Brevo retry, which is what we want here.
    console.error('[brevo-webhook] failed:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
