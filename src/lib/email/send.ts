import { Resend } from 'resend';

export type SendEmailArgs = {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
};

export type SendEmailResult =
  | { ok: true; id: string | null }
  | { ok: false; reason: 'not_configured' | 'send_failed'; message?: string };

let cached: Resend | null = null;

function getClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!cached) cached = new Resend(key);
  return cached;
}

/**
 * Sends an email via Resend. If RESEND_API_KEY is missing the call is logged
 * to the server console and `{ ok: false, reason: 'not_configured' }` is
 * returned — the caller should NOT treat this as a fatal error so the contact
 * form keeps working before email is wired up.
 */
export async function sendEmail(args: SendEmailArgs): Promise<SendEmailResult> {
  const client = getClient();
  const from = args.from || process.env.EMAIL_FROM_DEFAULT;

  if (!client || !from) {
    console.warn(
      '[email] Resend not configured — skipping send. to=%o subject=%s',
      args.to,
      args.subject,
    );
    return { ok: false, reason: 'not_configured' };
  }

  try {
    const { data, error } = await client.emails.send({
      from,
      to: args.to,
      subject: args.subject,
      html: args.html,
      replyTo: args.replyTo,
    });
    if (error) {
      console.error('[email] Resend error:', error);
      return { ok: false, reason: 'send_failed', message: error.message };
    }
    return { ok: true, id: data?.id ?? null };
  } catch (err) {
    console.error('[email] Resend threw:', err);
    return {
      ok: false,
      reason: 'send_failed',
      message: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}
