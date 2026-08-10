import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { Mail, MessageCircle, MapPin, CalendarDays, UserRound } from 'lucide-react';

import { fetchPage, fetchPageSections, fetchFounderPhotoUrl } from '@/lib/cms/pages';
import { fetchSiteSettings } from '@/lib/cms/settings';
import { fetchContentBySection } from '@/lib/cms/content';
import { SectionList } from '@/components/public/SectionRenderer';
import { SERVICES } from '@/config/services';
import { ContactForm } from '@/components/public/ContactForm';
import { buildPageMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const page = await fetchPage('contact');
  return buildPageMetadata({
    path: '/contact',
    cmsPage: page,
    fallback: {
      title: 'Contact | PaceMakers Business Consultants',
      description: 'Start a conversation about your mandate.',
      ogSubtitle: 'Tell us about the mandate.',
    },
  });
}

export default async function ContactPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const search = await props.searchParams;
  const isPreview = search.preview === '1';

  // /services/[slug] CTAs link here as `?service=<slug>`, so pre-fill the
  // service-interest dropdown with the matching service title when present.
  const rawService = search.service;
  const serviceSlug = typeof rawService === 'string' ? rawService : '';
  const defaultServiceTitle =
    SERVICES.find((s) => s.slug === serviceSlug)?.title ?? undefined;

  const [sections, settings, bookingCopy, contactCopy, founderPhotoUrl] =
    await Promise.all([
      fetchPageSections('contact', { onlyVisible: !isPreview }),
      safe(fetchSiteSettings(), {}),
      safe(fetchContentBySection('booking'), {} as Record<string, string>),
      safe(fetchContentBySection('contact'), {} as Record<string, string>),
      // Read from the founder_hero section rather than hardcoded: uploading a
      // new portrait in the page builder updates this card too.
      safe(fetchFounderPhotoUrl(), null),
    ]);

  const hcaptchaSiteKey = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY || null;

  const founderName = contactCopy.founder_name || 'Ahmad Din';

  return (
    <>
      <SectionList sections={sections} />

      <section className="bg-[color:var(--pmbc-surface-cream)] px-6 py-24 lg:py-28">
        <div className="mx-auto max-w-[1200px]">
          <div className="grid gap-12 lg:grid-cols-12">
            {/* Form */}
            <div className="lg:col-span-7">
              <div className="rounded-lg border border-[color:var(--pmbc-border)] bg-white p-8 shadow-[0_1px_3px_rgba(15,37,64,0.04)] sm:p-10">
                <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[color:var(--pmbc-primary)]">
                  Start a conversation
                </p>
                <h2 className="mt-3 font-serif text-2xl font-semibold tracking-tight text-[color:var(--pmbc-text)] sm:text-3xl">
                  Tell us about the mandate
                </h2>
                <p className="mt-3 text-[14px] leading-relaxed text-[color:var(--pmbc-muted)]">
                  We respond to every credible enquiry within one to two business days.
                </p>

                {/* Booking callout. Copy lives in cms_content under the
                    `booking` section, with fallbacks here so the callout still
                    reads correctly on a database missing migration 039. */}
                <div className="mt-7 flex flex-col gap-5 border-l-[3px] border-[color:var(--pmbc-accent)] bg-[color:var(--pmbc-surface-cream)] p-6 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                  <div className="flex items-start gap-4">
                    <CalendarDays
                      size={22}
                      strokeWidth={1.6}
                      className="mt-0.5 shrink-0"
                      style={{ color: 'var(--pmbc-accent)' }}
                    />
                    <div>
                      <p className="font-serif text-[18px] font-semibold text-[color:var(--pmbc-primary)]">
                        {bookingCopy.contact_prompt || 'Prefer to talk?'}
                      </p>
                      <p className="mt-1.5 text-[14px] leading-relaxed text-[color:var(--pmbc-muted)]">
                        {bookingCopy.contact_callout_body ||
                          'Book a 60 minute advisory meeting directly with Ahmad.'}
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/book"
                    className="inline-flex shrink-0 items-center justify-center border border-[color:var(--pmbc-primary)] bg-[color:var(--pmbc-primary)] px-6 py-3 text-[12px] font-semibold uppercase text-[color:var(--pmbc-text-on-dark)] transition duration-200 hover:border-[color:var(--pmbc-accent)] hover:bg-[color:var(--pmbc-accent)] hover:text-[color:var(--pmbc-primary-deep)]"
                    style={{ letterSpacing: '0.12em' }}
                  >
                    {bookingCopy.contact_callout_cta || 'Book a Meeting'}
                  </Link>
                </div>

                <div className="mt-8">
                  <ContactForm
                    services={SERVICES.map((s) => ({ slug: s.slug, title: s.title }))}
                    hcaptchaSiteKey={hcaptchaSiteKey}
                    defaultServiceTitle={defaultServiceTitle}
                  />
                </div>
              </div>
            </div>

            {/* Contact info column */}
            <div className="lg:col-span-5">
              <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[color:var(--pmbc-primary)]">
                Direct
              </p>
              <h3 className="mt-3 font-serif text-2xl font-semibold tracking-tight text-[color:var(--pmbc-text)]">
                Other ways to reach us
              </h3>
              <p className="mt-3 text-[14px] leading-relaxed text-[color:var(--pmbc-muted)]">
                For urgent matters or referrals, you can reach the firm directly.
              </p>

              <ul className="mt-8 space-y-5">
                {/* Three published addresses, each routing a different kind of
                    enquiry. Rendered from site_settings so they stay editable,
                    and each row appears only when its address is set, so
                    clearing one removes the row rather than leaving a gap. */}
                {settings.contact_email_advisory && (
                  <ContactRow
                    icon={<Mail size={16} />}
                    label={settings.contact_label_advisory || 'Mandate and advisory enquiries'}
                    href={`mailto:${settings.contact_email_advisory}`}
                    value={settings.contact_email_advisory}
                  />
                )}
                {settings.contact_email && (
                  <ContactRow
                    icon={<Mail size={16} />}
                    label={settings.contact_label_general || 'General enquiries'}
                    href={`mailto:${settings.contact_email}`}
                    value={settings.contact_email}
                  />
                )}
                {settings.contact_email_founder && (
                  <ContactRow
                    icon={<UserRound size={16} />}
                    label={settings.contact_label_founder || 'Direct to the founder'}
                    href={`mailto:${settings.contact_email_founder}`}
                    value={settings.contact_email_founder}
                  />
                )}
                {settings.whatsapp_number && (
                  <ContactRow
                    icon={<MessageCircle size={16} />}
                    label="WhatsApp"
                    href={`https://wa.me/${settings.whatsapp_number.replace(/[^0-9]/g, '')}`}
                    value={settings.whatsapp_number}
                    external
                  />
                )}
                {settings.office_location_text && (
                  <ContactRow
                    icon={<MapPin size={16} />}
                    label="Office"
                    value={settings.office_location_text}
                  />
                )}
              </ul>

              {/* Founder direct-discussion card. Copy lives in cms_content
                  under the `contact` section; the portrait is read from the
                  founder_hero section, so uploading a new one in the page
                  builder updates this card with no code change. */}
              <div className="mt-10 border-l-[3px] border-[color:var(--pmbc-accent)] bg-[color:var(--pmbc-surface-cream)] p-7">
                <div className="flex items-start gap-5">
                  <div className="relative h-[72px] w-[72px] shrink-0">
                    <div
                      aria-hidden
                      className="absolute -inset-1 border border-[color:var(--pmbc-accent)]"
                    />
                    {founderPhotoUrl ? (
                      <div className="relative h-[72px] w-[72px] overflow-hidden bg-neutral-100">
                        <Image
                          src={founderPhotoUrl}
                          alt={founderName}
                          fill
                          sizes="72px"
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="flex h-[72px] w-[72px] items-center justify-center bg-white">
                        <span className="font-serif text-[24px] font-semibold text-[color:var(--pmbc-primary)]">
                          {initials(founderName)}
                        </span>
                      </div>
                    )}
                  </div>

                  <div>
                    <h4 className="font-serif text-[19px] font-semibold leading-snug tracking-tight text-[color:var(--pmbc-primary)]">
                      {contactCopy.founder_heading || 'Speak directly with the founder'}
                    </h4>
                    <p className="mt-2.5 text-[14px] leading-relaxed text-[color:var(--pmbc-muted)]">
                      {contactCopy.founder_body ||
                        'Every mandate at PaceMakers is led personally by Ahmad Din. If you would rather discuss your situation before writing it down, book a call.'}
                    </p>
                    <Link
                      href="/book"
                      className="group mt-5 inline-flex items-center gap-2 text-[12px] font-semibold uppercase text-[color:var(--pmbc-primary)] transition hover:text-[color:var(--pmbc-accent)]"
                      style={{ letterSpacing: '0.12em' }}
                    >
                      <span className="relative pb-1">
                        {contactCopy.founder_cta_label || 'Book a Meeting'}
                        <span
                          aria-hidden
                          className="absolute right-0 bottom-0 left-0 h-px bg-[color:var(--pmbc-accent)]"
                        />
                      </span>
                      <span aria-hidden style={{ color: 'var(--pmbc-accent)' }}>
                        &#8594;
                      </span>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

/** Monogram fallback for the founder card when no portrait has been uploaded. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'PM';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function ContactRow({
  icon,
  label,
  value,
  href,
  external,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href?: string;
  external?: boolean;
}) {
  const inner = (
    <>
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[color:var(--pmbc-primary)] ring-1 ring-[color:var(--pmbc-border)]">
        {icon}
      </span>
      <div>
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.2em] text-[color:var(--pmbc-muted)]">
          {label}
        </p>
        <p className="mt-1 text-[14px] font-medium text-[color:var(--pmbc-text)]">
          {value}
        </p>
      </div>
    </>
  );

  return (
    <li>
      {href ? (
        <a
          href={href}
          target={external ? '_blank' : undefined}
          rel={external ? 'noreferrer' : undefined}
          className="flex items-start gap-4 hover:text-[color:var(--pmbc-primary)]"
        >
          {inner}
        </a>
      ) : (
        <div className="flex items-start gap-4">{inner}</div>
      )}
    </li>
  );
}

async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p;
  } catch {
    return fallback;
  }
}
