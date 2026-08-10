import type { Metadata } from 'next';
import Link from 'next/link';
import { Mail, MessageCircle, CalendarDays } from 'lucide-react';

import { fetchPage, fetchPageSections } from '@/lib/cms/pages';
import { fetchSiteSettings } from '@/lib/cms/settings';
import { fetchContentBySection } from '@/lib/cms/content';
import { FirmPageBody } from '@/components/public/FirmPageBody';
import { CalendlyEmbed } from '@/components/public/CalendlyEmbed';
import { buildPageMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const page = await fetchPage('book');
  return buildPageMetadata({
    path: '/book',
    cmsPage: page,
    fallback: {
      title: 'Book a Meeting | PaceMakers Business Consultants',
      description:
        'Book an introductory call with PaceMakers Business Consultants. No cost, no obligation, and a direct conversation about your mandate.',
      ogSubtitle: 'Start the conversation.',
    },
  });
}

export default async function BookPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const search = await props.searchParams;
  const isPreview = search.preview === '1';

  const [sections, settings, copy] = await Promise.all([
    fetchPageSections('book', { onlyVisible: !isPreview }),
    safe(fetchSiteSettings(), {}),
    safe(fetchContentBySection('booking'), {} as Record<string, string>),
  ]);

  // Admin-editable in Site Settings, so the calendar can be repointed without a
  // deploy. Empty is a supported state: the page then leads with the direct
  // contact routes instead of rendering an empty widget frame.
  const bookingUrl = (settings.booking_url ?? '').trim();

  const fallbackPrompt = copy.fallback_prompt || 'Trouble viewing the calendar?';
  const fallbackLinkLabel = copy.fallback_link_label || 'Open Calendly directly';
  const alternativesText =
    copy.alternatives_text ||
    'You can also write to us directly, or send the mandate details through the contact form.';

  const whatsappDigits = (settings.whatsapp_number ?? '').replace(/[^0-9]/g, '');

  return (
    <>
      <FirmPageBody
        sections={sections}
        fallbackHero={{
          eyebrow: 'Book a Meeting',
          headline: 'Start the conversation.',
          tagline:
            'An introductory call at no cost and no obligation. We will discuss the mandate, the timeline, and whether PaceMakers is the right firm for it.',
        }}
      />

      <section className="bg-[color:var(--pmbc-surface-cream)] px-6 py-20 sm:py-24 lg:py-28">
        <div className="mx-auto w-full max-w-[1200px]">
          {bookingUrl ? (
            <>
              <div className="mx-auto max-w-2xl text-center">
                <div
                  aria-hidden
                  className="mx-auto h-px w-[60px]"
                  style={{ background: 'var(--pmbc-accent-muted)' }}
                />
                <p
                  className="mt-5 text-[11px] font-semibold uppercase"
                  style={{
                    letterSpacing: '0.18em',
                    color: 'var(--pmbc-accent-muted)',
                  }}
                >
                  {copy.calendar_eyebrow || 'Select a time'}
                </p>
              </div>

              <div className="mt-10">
                <CalendlyEmbed url={bookingUrl} minHeight={700} />
              </div>

              <p className="mt-8 text-center text-[14px] leading-relaxed text-[color:var(--pmbc-muted)]">
                {fallbackPrompt}{' '}
                <a
                  href={bookingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-[color:var(--pmbc-primary)] underline decoration-[color:var(--pmbc-accent)] underline-offset-4 hover:text-[color:var(--pmbc-primary-deep)]"
                >
                  {fallbackLinkLabel}
                </a>
              </p>
            </>
          ) : (
            <div className="mx-auto max-w-2xl rounded-lg border border-[color:var(--pmbc-border-warm)] bg-white p-10 text-center">
              <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[color:var(--pmbc-surface-cream)] text-[color:var(--pmbc-primary)]">
                <CalendarDays size={18} />
              </span>
              <h2 className="mt-5 font-serif text-2xl font-semibold tracking-tight text-[color:var(--pmbc-text-primary)]">
                {copy.empty_heading || 'The calendar is being set up'}
              </h2>
              <p className="mt-3 text-[15px] leading-relaxed text-[color:var(--pmbc-muted)]">
                {copy.empty_body ||
                  'Self-service booking is not live yet. Reach us directly and we will find a time.'}
              </p>
            </div>
          )}

          {/* Direct routes, always shown. A booking widget that fails to load
              should never leave a prospective client with no way to reach us. */}
          <div className="mx-auto mt-14 max-w-2xl border-t border-[color:var(--pmbc-border-warm)] pt-10 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--pmbc-muted)]">
              {copy.alternatives_label || 'Other ways to reach us'}
            </p>
            <p className="mt-4 text-[15px] leading-relaxed text-[color:var(--pmbc-muted)]">
              {alternativesText}
            </p>

            <div className="mt-7 flex flex-wrap items-center justify-center gap-4">
              {settings.contact_email && (
                <a
                  href={`mailto:${settings.contact_email}?subject=${encodeURIComponent('Meeting request')}`}
                  className="inline-flex items-center gap-2 border border-[color:var(--pmbc-primary)] bg-[color:var(--pmbc-primary)] px-7 py-3 text-[13px] font-semibold uppercase text-white transition duration-200 hover:bg-[color:var(--pmbc-primary-deep)]"
                  style={{ letterSpacing: '0.12em' }}
                >
                  <Mail size={15} />
                  {settings.contact_email}
                </a>
              )}
              {whatsappDigits && (
                <a
                  href={`https://wa.me/${whatsappDigits}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 border border-[#1B3A5F]/30 px-7 py-3 text-[13px] font-semibold uppercase text-[color:var(--pmbc-primary)] transition duration-200 hover:border-[color:var(--pmbc-primary)]"
                  style={{ letterSpacing: '0.12em' }}
                >
                  <MessageCircle size={15} />
                  WhatsApp
                </a>
              )}
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 border border-[#1B3A5F]/30 px-7 py-3 text-[13px] font-semibold uppercase text-[color:var(--pmbc-primary)] transition duration-200 hover:border-[color:var(--pmbc-primary)]"
                style={{ letterSpacing: '0.12em' }}
              >
                {copy.contact_form_label || 'Send a message'}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p;
  } catch {
    return fallback;
  }
}
