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
});

async function verifyHcaptcha(token: string | undefined): Promise<boolean> {
  const secret = process.env.HCAPTCHA_SECRET_KEY;
  if (!secret) return true; // captcha not configured — allow
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

  // Send the two emails. Failures here should NOT fail the request — the
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
    console.warn('[contact] no admin email configured — skipping notification');
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
    company: data.company || '-',
    phone: data.phone || '-',
    country: data.country || '-',
    service_interest: data.service_interest || '-',
    source_page: data.source_page || '-',
    message: data.message,
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
  const vars: Record<string, string | undefined> = { name: data.name };
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
