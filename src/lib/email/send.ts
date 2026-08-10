/**
 * Transactional email through Brevo.
 *
 * Deliberately plain `fetch` against the v3 REST API rather than the
 * `@getbrevo/brevo` SDK. Sending is a single POST to a single endpoint, so the
 * SDK buys nothing, and it costs several things: it is generated from an
 * OpenAPI spec, so its models are largely optional-everything with loose types,
 * it drags in a transitive HTTP stack, and its CJS/ESM shape has historically
 * needed coaxing inside Next server bundles. Twenty lines of hand-written types
 * describe the request more precisely than the generated ones do.
 *
 * The exported surface is unchanged from the Resend implementation this
 * replaces, so no caller needed editing.
 */

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';

export type SendEmailArgs = {
  to: string | string[];
  subject: string;
  html: string;
  /** Overrides EMAIL_FROM_DEFAULT. Accepts "someone@example.com" or "Name <someone@example.com>". */
  from?: string;
  replyTo?: string;
};

export type SendEmailResult =
  | { ok: true; id: string | null }
  | { ok: false; reason: 'not_configured' | 'send_failed'; message?: string };

type BrevoContact = { email: string; name?: string };

type BrevoPayload = {
  sender: BrevoContact;
  to: BrevoContact[];
  subject: string;
  htmlContent: string;
  replyTo?: BrevoContact;
};

/**
 * Splits "Name <addr@example.com>" into its parts, and passes a bare address
 * through untouched.
 *
 * Worth handling rather than assuming a bare address: the Resend setup this
 * replaces used the "Name <addr>" convention, so an existing deployment may
 * already have EMAIL_FROM_DEFAULT in that form. Brevo wants the two separately,
 * and sending the whole string as the address would be rejected as malformed.
 */
function parseAddress(value: string): BrevoContact | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const angled = trimmed.match(/^\s*(.*?)\s*<\s*([^<>\s]+@[^<>\s]+)\s*>\s*$/);
  if (angled) {
    const name = angled[1].replace(/^["']|["']$/g, '').trim();
    return name ? { email: angled[2], name } : { email: angled[2] };
  }
  if (!trimmed.includes('@')) return null;
  return { email: trimmed };
}

function recipients(to: string | string[]): BrevoContact[] {
  const list = Array.isArray(to) ? to : [to];
  return list
    .map((entry) => parseAddress(entry))
    .filter((c): c is BrevoContact => c !== null);
}

/**
 * Sends one email.
 *
 * Never throws. When BREVO_API_KEY or a usable sender address is missing, the
 * call is logged and `{ ok: false, reason: 'not_configured' }` is returned. The
 * contact form treats that as non-fatal, so a submission is still saved to the
 * admin inbox on a deployment where email has not been wired up yet. That
 * behaviour is the whole reason this wrapper exists and is preserved exactly
 * as it was under Resend.
 */
export async function sendEmail(args: SendEmailArgs): Promise<SendEmailResult> {
  const apiKey = process.env.BREVO_API_KEY;
  const fromRaw = args.from || process.env.EMAIL_FROM_DEFAULT;
  const sender = fromRaw ? parseAddress(fromRaw) : null;
  const to = recipients(args.to);

  if (!apiKey || !sender || to.length === 0) {
    console.warn(
      '[email] Brevo not configured, skipping send. to=%o subject=%s (apiKey=%s sender=%s)',
      args.to,
      args.subject,
      apiKey ? 'set' : 'missing',
      sender ? 'ok' : 'missing or malformed',
    );
    return { ok: false, reason: 'not_configured' };
  }

  // A display name on the sender is optional to Brevo but not to inbox
  // placement: without one, clients show the bare address, which reads as
  // machine-generated on a firm that trades on being senior and considered.
  if (!sender.name && process.env.EMAIL_FROM_NAME) {
    sender.name = process.env.EMAIL_FROM_NAME;
  }

  const payload: BrevoPayload = {
    sender,
    to,
    subject: args.subject,
    htmlContent: args.html,
  };

  const replyTo = args.replyTo ? parseAddress(args.replyTo) : null;
  if (replyTo) payload.replyTo = replyTo;

  try {
    const res = await fetch(BREVO_ENDPOINT, {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify(payload),
      // Never let a hung provider hold a contact-form request open. The
      // submission is already saved by this point, so failing fast is strictly
      // better than making the visitor wait.
      signal: AbortSignal.timeout(15_000),
    });

    const bodyText = await res.text();

    if (!res.ok) {
      // Brevo returns { code, message } on error. Fall back to the raw body if
      // it is not JSON, so a gateway error page still shows up in the logs.
      let message = bodyText;
      try {
        const parsed = JSON.parse(bodyText) as { message?: string; code?: string };
        if (parsed.message) message = `${parsed.code ?? res.status}: ${parsed.message}`;
      } catch {
        // keep the raw text
      }
      console.error('[email] Brevo error %s: %s', res.status, message);
      return { ok: false, reason: 'send_failed', message };
    }

    let id: string | null = null;
    try {
      const parsed = JSON.parse(bodyText) as { messageId?: string };
      id = parsed.messageId ?? null;
    } catch {
      // A 2xx with an unparseable body still means it was accepted.
    }
    return { ok: true, id };
  } catch (err) {
    console.error('[email] Brevo request threw:', err);
    return {
      ok: false,
      reason: 'send_failed',
      message: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}
