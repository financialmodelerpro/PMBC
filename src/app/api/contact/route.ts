import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { fetchSiteSettings } from '@/lib/cms/settings';
import { sendEmail } from '@/lib/email/send';
import { baseLayoutBranded } from '@/lib/email/templates/_base';
import { renderTemplate, renderSubject } from '@/lib/email/render';

export const dynamic = 'force-dynamic';

const ContactSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  email: z.string().trim().email('Valid email required').max(200),
  company: z.string().trim().max(160).optional().or(z.literal('')),
  phone: z.string().trim().max(40).optional().or(z.literal('')),
  country: z.string().trim().max(80).optional().or(z.literal('')),
  service_interest: z.string().trim().max(160).optional().or(z.literal('')),
  message: z.string().trim().min(10, 'Please share a bit more context').max(4000),
  source_page: z.string().trim().max(200).optional().or(z.literal('')),
  hcaptcha_token: z.string().optional(),
  /**
   * The honeypot field. Named as an ordinary form field so a bot's filler
   * recognises it; a person never sees it, so anything in it is a bot.
   */
  website: z.string().optional(),
  /** Milliseconds between the form appearing and the submit. */
  elapsed_ms: z.number().optional(),
});

/**
 * The floor a real submission cannot go under.
 *
 * Three seconds is well below a person reading a five-field form, filling in a
 * name, an email and at least ten characters of message, and well above what a
 * script needs. It is a heuristic, not a proof: a patient bot waits, and a
 * visitor who pastes everything from a clipboard in two seconds is refused
 * wrongly. Both are accepted because the alternative on the table was nothing
 * at all.
 */
const MIN_FILL_MS = 3000;

/**
 * Silence, dressed as success.
 *
 * A bot that is told it was blocked knows to change something and try again. A
 * bot that is told it succeeded stops. So a rejected submission gets the same
 * 200 and the same shape a real one gets, with an id that belongs to nothing.
 * Logged server side, since a spike here is the only way anyone would find out
 * the filter is doing something.
 */
function silentlyAccepted(reason: string): NextResponse {
  console.warn('[contact] discarded a submission: ' + reason);
  return NextResponse.json({ ok: true, id: null });
}

async function verifyHcaptcha(token: string | undefined): Promise<boolean> {
  const secret = process.env.HCAPTCHA_SECRET_KEY;
  if (!secret) return true; // captcha not configured, so allow the submission
  if (!token) return false;
  try {
    const params = new URLSearchParams({ secret, response: token });
    const res = await fetch('https://hcaptcha.com/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const data = (await res.json()) as { success?: boolean };
    return Boolean(data.success);
  } catch (err) {
    console.error('[contact] hcaptcha verify failed:', err);
    return false;
  }
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = ContactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Validation failed',
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      },
      { status: 400 },
    );
  }

  const data = parsed.data;

  // Spam filtering, before anything is written or sent.
  //
  // hCaptcha stays wired below and dormant: with no HCAPTCHA_SECRET_KEY set it
  // passes everything through, so switching it back on is the two env vars and
  // no code change. These two checks are what stands in for it meanwhile.
  if ((data.website ?? '').trim() !== '') {
    return silentlyAccepted('honeypot filled');
  }
  if (typeof data.elapsed_ms === 'number' && data.elapsed_ms < MIN_FILL_MS) {
    return silentlyAccepted(`submitted after ${data.elapsed_ms}ms, under the ${MIN_FILL_MS}ms floor`);
  }

  const captchaOk = await verifyHcaptcha(data.hcaptcha_token);
  if (!captchaOk) {
    return NextResponse.json({ error: 'Captcha verification failed' }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();

  const { data: inserted, error: insertError } = await supabase
    .from('contact_submissions')
    .insert({
      name: data.name,
      email: data.email,
      company: data.company || null,
      phone: data.phone || null,
      country: data.country || null,
      service_interest: data.service_interest || null,
      message: data.message,
      source_page: data.source_page || null,
      status: 'new',
    })
    .select('id')
    .single();

  if (insertError || !inserted) {
    console.error('[contact] insert failed:', insertError);
    return NextResponse.json({ error: 'Could not save submission' }, { status: 500 });
  }

  // Send the two emails. Failures here should NOT fail the request: the
  // submission is already saved and visible in the admin inbox.
  await Promise.all([
    sendNotification(inserted.id, data),
    sendAcknowledgement(data),
  ]).catch((err) => console.error('[contact] email send threw:', err));

  return NextResponse.json({ ok: true, id: inserted.id });
}

type ContactData = z.infer<typeof ContactSchema>;

async function loadTemplates() {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from('email_templates')
    .select('template_key, subject, body_html, enabled')
    .in('template_key', ['contact_notification', 'contact_acknowledgement']);
  const map = new Map<string, { subject: string; body_html: string; enabled: boolean }>();
  for (const r of data ?? []) {
    map.set(r.template_key, {
      subject: r.subject,
      body_html: r.body_html,
      enabled: r.enabled,
    });
  }
  return map;
}

async function sendNotification(id: string, data: ContactData) {
  const settings = await safe(fetchSiteSettings(), {});
  const adminEmail =
    settings.admin_email ||
    process.env.EMAIL_TO_ADMIN ||
    process.env.EMAIL_FROM_DEFAULT;
  if (!adminEmail) {
    console.warn('[contact] no admin email configured, skipping notification');
    return;
  }
  const templates = await loadTemplates();
  const tpl = templates.get('contact_notification');
  if (!tpl || !tpl.enabled) {
    console.warn('[contact] contact_notification template missing or disabled');
    return;
  }

  const vars: Record<string, string | undefined> = {
    name: data.name,
    email: data.email,
    company: data.company || 'Not given',
    phone: data.phone || 'Not given',
    country: data.country || 'Not given',
    service_interest: data.service_interest || 'Not specified',
    source_page: data.source_page || '-',
    // Puts the company in the subject line without leaving a dangling comma
    // when there is none. The inbox is scanned by subject, and "New enquiry:
    // Leslie Merricroft, Al-Mashrea Law Firm" is worth more at a glance than
    // the name alone.
    company_suffix: data.company ? `, ${data.company}` : '',
    message: data.message,
    // Same text, with the enquirer's line breaks preserved. `{{message}}` is
    // escaped but its newlines collapse in HTML, so a message written in
    // paragraphs arrived as one block. The template uses this one; `{{message}}`
    // still resolves, since an operator may have it in an edited template.
    message_html: data.message,
    submission_id: id,
  };
  const subject = renderSubject(tpl.subject, vars);
  const body = renderTemplate(tpl.body_html, vars);
  const html = await baseLayoutBranded(body);

  await sendEmail({
    to: adminEmail,
    subject,
    html,
    replyTo: data.email,
  });
}

async function sendAcknowledgement(data: ContactData) {
  const templates = await loadTemplates();
  const tpl = templates.get('contact_acknowledgement');
  if (!tpl || !tpl.enabled) {
    console.warn('[contact] contact_acknowledgement template missing or disabled');
    return;
  }
  // The acknowledgement echoes what was sent, so the enquirer has a record of
  // it without going back to the site. Same variable names as the notification,
  // so an operator editing either template does not have to learn two sets.
  const vars: Record<string, string | undefined> = {
    name: data.name,
    email: data.email,
    company: data.company || 'Not given',
    country: data.country || 'Not given',
    service_interest: data.service_interest || 'Not specified',
    message: data.message,
    message_html: data.message,
  };
  const subject = renderSubject(tpl.subject, vars);
  const body = renderTemplate(tpl.body_html, vars);
  const html = await baseLayoutBranded(body);

  await sendEmail({
    to: data.email,
    subject,
    html,
    from: process.env.EMAIL_FROM_CONTACT,
  });
}

async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p;
  } catch {
    return fallback;
  }
}
