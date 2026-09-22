# Email reference

Moved verbatim from `CLAUDE.md` on 2026-09-22 (original kept at `docs/archive/CLAUDE.md.bak-2026-09-22`). Contradictions found in the split were resolved to the current behaviour; each such line is noted in `docs/HISTORY.md` under 2026-09-22.

**Read this before:** changing the Brevo wrapper, an email template, the email shell, or the Brevo webhook.

## 7. Email System

### Brevo Setup

**Migrated from Resend to Brevo on 2026-08-10.** One Brevo account, one authenticated sending domain (`pacemakersglobal.com`). Create the API key under **SMTP & API, then API Keys**. Domain authentication (SPF, DKIM, DMARC) follows Brevo's standard flow and must be completed or mail lands in spam.

No SDK. `src/lib/email/send.ts` posts to `https://api.brevo.com/v3/smtp/email` with plain `fetch`. Sending is a single POST to a single endpoint, so `@getbrevo/brevo` buys nothing while costing loose OpenAPI-generated types, a transitive HTTP stack, and CJS/ESM friction inside the Next server bundle. The request and response are typed by hand in that file.

The exported surface (`sendEmail`, `SendEmailArgs`, `SendEmailResult`) is unchanged from the Resend implementation, so no caller was edited. The graceful fallback is unchanged too: a missing `BREVO_API_KEY` or sender logs a warning and returns `{ ok: false, reason: 'not_configured' }` without throwing, so the contact form still saves to the admin inbox on a deployment where email is not wired up.

`from` accepts either a bare address or `Name <addr@example.com>`; Brevo needs the two parts separately, and the old Resend setup used the angled form, so both are parsed. `EMAIL_FROM_NAME` supplies the display name when the address carries none.

### Templates

For v1, only two templates exist. Both are stored in `email_templates` table and editable via admin.

**contact_notification**: sent to admin when contact form submitted. Recipient: configured admin email from `site_settings.admin_email`. Variables: name, email, company, phone, country, service_interest, message, source_page, submission_id.

**contact_acknowledgement**: sent to the person who submitted the form. Recipient: their email. Variables: name. Body confirms receipt and sets a 1-2 business day response expectation.

### Base Layout

```typescript
// src/lib/email/templates/_base.ts
export async function baseLayoutBranded(content: string): Promise<string> {
  const branding = await fetchEmailBranding();
  return `
    <!DOCTYPE html>
    <html>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: ${branding.primary_color}; padding: 20px; text-align: center;">
        ${branding.logo_url ? `<img src="${branding.logo_url}" alt="PaceMakers" height="40" />` : '<h1 style="color: white;">PaceMakers</h1>'}
      </div>
      <div style="padding: 30px 20px;">
        ${content}
      </div>
      <div style="border-top: 1px solid #eee; padding: 20px; font-size: 12px; color: #666;">
        ${branding.footer_html || ''}
      </div>
    </body>
    </html>
  `;
}
```

### Send Wrapper

```typescript
// src/lib/email/send.ts (shape only, see the file for the real implementation)
const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';

export async function sendEmail(args: SendEmailArgs): Promise<SendEmailResult> {
  const apiKey = process.env.BREVO_API_KEY;
  const sender = parseAddress(args.from || process.env.EMAIL_FROM_DEFAULT || '');
  if (!apiKey || !sender) return { ok: false, reason: 'not_configured' };

  const res = await fetch(BREVO_ENDPOINT, {
    method: 'POST',
    headers: { 'api-key': apiKey, 'content-type': 'application/json' },
    body: JSON.stringify({
      sender,
      to: recipients(args.to),
      subject: args.subject,
      htmlContent: args.html,
    }),
  });
  // ... error handling, returns { ok: true, id } on success
}
```

---

### Brevo webhook setup

1. Set `BREVO_WEBHOOK_TOKEN` on Vercel (Production) to a long random string, and redeploy.
2. In Brevo: **Transactional**, then **Settings**, then **Webhook**, then **Add a new webhook** (menu names as of September 2026; Brevo moves them occasionally).
3. URL: `https://www.pacemakersglobal.com/api/webhooks/brevo?token=<BREVO_WEBHOOK_TOKEN>`. Use the `www` host: the apex redirects, and a webhook should not depend on a redirect.
4. Events: Delivered, Opened, Clicked, Hard bounce, Soft bounce, Spam, Blocked, Invalid email, Deferred, Error, Unsubscribed. Proxy open and First opening are optional; they are recorded as opens.
5. Save, then use Brevo's test button: the response is 200 with `ignored: 1`, because the test event matches no lead.
6. Alternatively create it through the API with `"auth": {"type": "bearer", "token": "<BREVO_WEBHOOK_TOKEN>"}` and the URL without `?token=`. Both are accepted.

`npm run verify-brevo-webhook` covers authentication, matching, status ordering and duplicates; with `VERIFY_BASE` it confirms a running site refuses a missing or wrong token.
