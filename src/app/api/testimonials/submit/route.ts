import { NextResponse } from 'next/server';
import { z } from 'zod';

import type { SupabaseClient } from '@supabase/supabase-js';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { fetchSiteSettings } from '@/lib/cms/settings';
import { sendEmail } from '@/lib/email/send';
import { testimonialNotificationHtml } from '@/lib/email/templates/testimonialNotification';
import { normaliseLinkedInUrl } from '@/lib/public/externalUrl';
import { lookupLink, markLinkUsed, isMissingSchema } from '@/lib/cms/testimonialLinks';
import { siteUrl } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

/**
 * Client testimonial submission.
 *
 * Follows FMP's shape where it fits: insert with `status = 'pending'`, record a
 * `source`, and never let anything reach a public page without approval. What
 * FMP has no equivalent of, and is therefore PMBC's own, is the private link,
 * the consent record, the photo and the spam handling.
 *
 * **Multipart rather than JSON**, because of the photo. One endpoint handles the
 * whole submission including the upload, so there is no separate public upload
 * URL that could be used on its own to fill the bucket.
 */

/** The same three-second floor the contact form uses, for the same reasons. */
const MIN_FILL_MS = 3000;

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const PHOTO_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

/** Where submitted portraits go: the general media bucket, under a prefix. */
const PHOTO_BUCKET = 'cms-assets';
const PHOTO_PREFIX = 'testimonials';

const schema = z.object({
  name: z.string().trim().min(1, 'Please give your name').max(120),
  role: z.string().trim().max(160).optional().or(z.literal('')),
  company: z.string().trim().max(160).optional().or(z.literal('')),
  text: z
    .string()
    .trim()
    .min(40, 'Please write a little more, so the quote stands on its own')
    .max(2000),
  linkedin_url: z.string().trim().max(300).optional().or(z.literal('')),
  consent: z.literal('true', { message: 'Consent is required before this can be published' }),
  website: z.string().optional(),
  elapsed_ms: z.string().optional(),
  token: z.string().trim().max(200).optional().or(z.literal('')),
});

/**
 * Silence dressed as success, as on the contact form. A bot told it was blocked
 * changes something and tries again; a bot told it succeeded stops.
 */
function silentlyAccepted(reason: string): NextResponse {
  console.warn('[testimonials] discarded a submission: ' + reason);
  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Could not read the form.' }, { status: 400 });
  }

  const raw = {
    name: str(form.get('name')),
    role: str(form.get('role')),
    company: str(form.get('company')),
    text: str(form.get('text')),
    linkedin_url: str(form.get('linkedin_url')),
    consent: str(form.get('consent')),
    website: str(form.get('website')),
    elapsed_ms: str(form.get('elapsed_ms')),
    token: str(form.get('token')),
  };

  // Spam checks first, before validation, so a bot learns nothing from the
  // shape of a validation error either.
  if ((raw.website ?? '').trim() !== '') {
    return silentlyAccepted('honeypot filled');
  }
  const elapsed = Number(raw.elapsed_ms);
  if (Number.isFinite(elapsed) && elapsed > 0 && elapsed < MIN_FILL_MS) {
    return silentlyAccepted(`submitted after ${elapsed}ms, under the ${MIN_FILL_MS}ms floor`);
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Please check the form.' },
      { status: 400 },
    );
  }
  const data = parsed.data;

  // A token is optional. When one is present it must be real and live: a
  // revoked link is refused rather than quietly downgraded to an open
  // submission, because the person holding it was told it was theirs.
  let linkId: string | null = null;
  let via = 'the public form';
  if (data.token) {
    const found = await lookupLink(data.token);
    if (found.state === 'revoked') {
      return NextResponse.json(
        { error: 'That link has been withdrawn. Please get in touch for a new one.' },
        { status: 403 },
      );
    }
    if (found.state === 'unknown') {
      return NextResponse.json(
        { error: 'That link is not recognised. Please check it, or get in touch.' },
        { status: 404 },
      );
    }
    if (found.state === 'ok') {
      linkId = found.link.id;
      via = `private link: ${found.link.label}`;
      void markLinkUsed(found.link);
    }
    // 'unavailable' falls through as an ordinary submission: the schema not
    // being applied is not the client's problem, and losing their words would
    // be the worst outcome here.
  }

  // Untyped for the same reason as `testimonialLinks`: the generated types
  // predate migration 072, which is DDL and hand-run.
  const supabase = createSupabaseServerClient() as unknown as SupabaseClient;

  // Photo, optional. Uploaded before the insert so the row carries its URL, and
  // a failed upload loses the picture rather than the testimonial.
  let photoUrl: string | null = null;
  const file = form.get('photo');
  if (file instanceof File && file.size > 0) {
    if (!PHOTO_MIME.has(file.type)) {
      return NextResponse.json(
        { error: 'Please upload a JPEG, PNG or WebP image.' },
        { status: 400 },
      );
    }
    if (file.size > MAX_PHOTO_BYTES) {
      return NextResponse.json({ error: 'Please keep the photo under 5MB.' }, { status: 400 });
    }
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `${PHOTO_PREFIX}/${Date.now()}_${slug(data.name)}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: false });
    if (uploadError) {
      console.error('[testimonials] photo upload failed:', uploadError.message);
    } else {
      const { data: pub } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
      photoUrl = pub.publicUrl;
    }
  }

  const linkedin = normaliseLinkedInUrl(data.linkedin_url);

  const row: Record<string, unknown> = {
    name: data.name,
    role: data.role || '',
    company: data.company || '',
    text: data.text,
    status: 'pending',
    linkedin_url: linkedin,
    photo_url: photoUrl,
    source: linkId ? 'link' : 'form',
    consent_given: true,
    submitted_at: new Date().toISOString(),
    submitted_via_link_id: linkId,
  };

  let inserted = await supabase.from('testimonials').insert(row).select('id').single();

  // Migration 072 is DDL and has to be run by hand. Until it is, the six new
  // columns do not exist and the insert above fails on the first of them.
  // Rather than lose the testimonial, retry with only the columns that have
  // been there since Phase 10. The words and the pending status are what
  // matter; the LinkedIn URL and photo are recoverable from the email.
  if (inserted.error && isMissingSchema(inserted.error.message)) {
    console.warn(
      '[testimonials] migration 072 is not applied, so the submission was stored without its new fields',
    );
    inserted = await supabase
      .from('testimonials')
      .insert({
        name: data.name,
        role: data.role || '',
        company: data.company || '',
        text: data.text,
        status: 'pending',
      })
      .select('id')
      .single();
  }

  if (inserted.error) {
    console.error('[testimonials] insert failed:', inserted.error.message);
    return NextResponse.json(
      { error: 'Could not save your testimonial. Please try again.' },
      { status: 500 },
    );
  }

  // Notification. A failure here must not fail the request: the testimonial is
  // already in the queue, which is where it needs to be.
  void notify({
    name: data.name,
    role: data.role || '',
    company: data.company || '',
    text: data.text,
    linkedinUrl: linkedin,
    photoUrl,
    via,
  }).catch((err) => console.error('[testimonials] notification threw:', err));

  return NextResponse.json({ ok: true });
}

async function notify(args: {
  name: string;
  role: string;
  company: string;
  text: string;
  linkedinUrl: string | null;
  photoUrl: string | null;
  via: string;
}): Promise<void> {
  const settings = await fetchSiteSettings().catch(() => ({}) as Record<string, string>);
  const to =
    process.env.EMAIL_TO_ADMIN ||
    (settings as { admin_email?: string }).admin_email ||
    (settings as { contact_email?: string }).contact_email;
  if (!to) return;

  const html = await testimonialNotificationHtml({
    ...args,
    adminUrl: `${siteUrl()}/admin/testimonials`,
  });

  await sendEmail({
    to,
    subject: `Testimonial submitted by ${args.name}`,
    html,
  });
}

function str(v: FormDataEntryValue | null): string {
  return typeof v === 'string' ? v : '';
}

function slug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'testimonial'
  );
}
