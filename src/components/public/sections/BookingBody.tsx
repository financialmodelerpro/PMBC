import Link from 'next/link';
import { Mail, MessageCircle, CalendarDays } from 'lucide-react';

import { CalendlyEmbed } from '@/components/public/CalendlyEmbed';
import { SectionContainer } from '@/components/public/SectionContainer';
import type { PmbcVariant } from '@/lib/public/tokens';
import type { SectionContext } from '@/lib/public/sectionContext';

/**
 * The body of /book: the calendar band, and the direct routes under it.
 *
 * The copy was eight rows in `cms_content` under `booking` until migration 066.
 * It is now this section's content, so /book is edited entirely in the page
 * builder. The literals below are defaults for a section added by hand, and are
 * the wording those rows carried.
 *
 * The calendar URL itself stays in Site Settings. It is not copy, it is a
 * site-wide setting, and every booking surface reads the same one.
 *
 * The empty state is decided here, server side, on that URL being blank. It is
 * not a widget-failure fallback: if Calendly's script fails in the browser the
 * embed frame is what the visitor sees, so the direct routes below are rendered
 * either way rather than only in the empty case.
 */
export function BookingBody({
  content,
  styles,
  variant = 'cream',
  context = {},
}: {
  content: Record<string, unknown>;
  styles?: unknown;
  variant?: PmbcVariant;
  context?: SectionContext;
}) {
  const settings = context.settings ?? {};
  const bookingUrl = (context.bookingUrl ?? '').trim();

  const fallbackPrompt = s(content.fallback_prompt) || 'Trouble viewing the calendar?';
  const fallbackLinkLabel = s(content.fallback_link_label) || 'Open Calendly directly';
  const alternativesText =
    s(content.alternatives_text) ||
    'You can also write to us directly, or send the mandate details through the contact form.';

  const whatsappDigits = (settings.whatsapp_number ?? '').replace(/[^0-9]/g, '');

  return (
    <SectionContainer variant={variant} styles={styles}>
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
              {s(content.calendar_eyebrow) || 'Select a time'}
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
            {s(content.empty_heading) || 'The calendar is being set up'}
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-[color:var(--pmbc-muted)]">
            {s(content.empty_body) ||
              'Self-service booking is not live yet. Reach us directly and we will find a time.'}
          </p>
        </div>
      )}

      {/* Direct routes, always shown. A booking widget that fails to load
          should never leave a prospective client with no way to reach us. */}
      <div className="mx-auto mt-14 max-w-2xl border-t border-[color:var(--pmbc-border-warm)] pt-10 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--pmbc-muted)]">
          {s(content.alternatives_label) || 'Other ways to reach us'}
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
            {s(content.contact_form_label) || 'Send a message'}
          </Link>
        </div>
      </div>
    </SectionContainer>
  );
}

function s(v: unknown): string {
  return typeof v === 'string' ? v : '';
}
