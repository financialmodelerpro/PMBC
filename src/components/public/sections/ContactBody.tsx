import Link from 'next/link';
import Image from 'next/image';
import { Mail, MessageCircle, MapPin, CalendarDays, UserRound } from 'lucide-react';

import { SERVICES } from '@/config/services';
import { ContactForm } from '@/components/public/ContactForm';
import { SectionContainer } from '@/components/public/SectionContainer';
import type { PmbcVariant } from '@/lib/public/tokens';
import type { SectionContext } from '@/lib/public/sectionContext';
import { sectionCopy } from '@/lib/public/sectionCopy';

/**
 * The body of /contact: the form panel and the direct-contact column beside it.
 *
 * One section rather than two, because the two columns are one grid. Split into
 * a `contact_form` and a `contact_direct` section they would render as stacked
 * bands, which would be a layout rewrite rather than the move this is.
 *
 * The copy was thirteen rows in `cms_content` under `contact` until migration
 * 066. It is now this section's content, so /contact is edited entirely in the
 * page builder. The literals below are defaults for a section added by hand,
 * and are the wording those rows carried.
 *
 * The addresses are not copy and stay in Site Settings: they are the firm's,
 * not this page's, and the footer publishes the same values.
 */
export function ContactBody({
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
  const founderPhotoUrl = context.founderPhotoUrl ?? null;
  const hcaptchaSiteKey = context.hcaptchaSiteKey ?? null;

  const founderName = s(content.founder_name) || 'Ahmad Din';

  // Every string below follows one rule: absent means the shipped wording,
  // empty means the operator cleared the field and the element does not render.
  // See `sectionCopy` for why that distinction has to be made in one place.
  const formEyebrow = sectionCopy(content, 'form_eyebrow', 'Enquiry');
  const formHeading = sectionCopy(content, 'form_heading', 'Tell us about the mandate');
  const responseNote = sectionCopy(
    content,
    'form_response_note',
    'We respond to every credible enquiry within one to two business days.',
  );

  const bookingPrompt = sectionCopy(content, 'booking_prompt', 'Prefer to talk?');
  const bookingBody = sectionCopy(
    content,
    'booking_body',
    'Book a 60 minute advisory meeting directly with Ahmad.',
  );
  const bookingCtaLabel = sectionCopy(content, 'booking_cta_label', 'Book a Meeting');
  // Clearing all three removes the callout rather than leaving a bordered box
  // with a calendar icon and nothing to read.
  const showBookingCallout =
    bookingPrompt !== '' || bookingBody !== '' || bookingCtaLabel !== '';

  const directEyebrow = sectionCopy(content, 'direct_eyebrow', 'Direct');
  const directHeading = sectionCopy(content, 'direct_heading', 'Other ways to reach us');
  const directIntro = sectionCopy(
    content,
    'direct_intro',
    'For urgent matters or referrals, you can reach the firm directly.',
  );

  const founderHeading = sectionCopy(
    content,
    'founder_heading',
    'Speak directly with the founder',
  );
  const founderBody = sectionCopy(
    content,
    'founder_body',
    'Every mandate at PaceMakers is partner-led. If you would rather discuss your situation before writing it down, book a call.',
  );
  const founderCtaLabel = sectionCopy(content, 'founder_cta_label', 'Book a Meeting');
  // The portrait is not a reason to keep the card: with no heading, no body and
  // no link it is a framed photograph with nothing to say.
  const showFounderCard =
    founderHeading !== '' || founderBody !== '' || founderCtaLabel !== '';

  return (
    <SectionContainer variant={variant} styles={styles}>
      <div className="grid gap-12 lg:grid-cols-12">
        {/* Form */}
        <div className="lg:col-span-7">
          <div className="rounded-lg border border-[color:var(--pmbc-border)] bg-white p-8 shadow-[0_1px_3px_rgba(15,37,64,0.04)] sm:p-10">
            {formEyebrow && (
              <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[color:var(--pmbc-primary)]">
                {formEyebrow}
              </p>
            )}
            {formHeading && (
              <h2 className="mt-3 font-serif text-2xl font-semibold tracking-tight text-[color:var(--pmbc-text)] sm:text-3xl">
                {formHeading}
              </h2>
            )}
            {responseNote && (
              <p className="mt-3 text-[14px] leading-relaxed text-[color:var(--pmbc-muted)]">
                {responseNote}
              </p>
            )}

            {/* Booking callout. Clearing its three fields removes it. */}
            {showBookingCallout && (
              <div className="mt-7 flex flex-col gap-5 border-l-[3px] border-[color:var(--pmbc-accent)] bg-[color:var(--pmbc-surface-cream)] p-6 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                <div className="flex items-start gap-4">
                  <CalendarDays
                    size={22}
                    strokeWidth={1.6}
                    className="mt-0.5 shrink-0"
                    style={{ color: 'var(--pmbc-accent)' }}
                  />
                  <div>
                    {bookingPrompt && (
                      <p className="font-serif text-[18px] font-semibold text-[color:var(--pmbc-primary)]">
                        {bookingPrompt}
                      </p>
                    )}
                    {bookingBody && (
                      <p className="mt-1.5 text-[14px] leading-relaxed text-[color:var(--pmbc-muted)]">
                        {bookingBody}
                      </p>
                    )}
                  </div>
                </div>
                {bookingCtaLabel && (
                  <Link
                    href="/book"
                    className="inline-flex shrink-0 items-center justify-center border border-[color:var(--pmbc-primary)] bg-[color:var(--pmbc-primary)] px-6 py-3 text-[12px] font-semibold uppercase text-[color:var(--pmbc-text-on-dark)] transition duration-200 hover:border-[color:var(--pmbc-accent)] hover:bg-[color:var(--pmbc-accent)] hover:text-[color:var(--pmbc-primary-deep)]"
                    style={{ letterSpacing: '0.12em' }}
                  >
                    {bookingCtaLabel}
                  </Link>
                )}
              </div>
            )}

            <div className="mt-8">
              <ContactForm
                services={SERVICES.map((x) => ({ slug: x.slug, title: x.title }))}
                hcaptchaSiteKey={hcaptchaSiteKey}
                defaultServiceTitle={context.defaultServiceTitle}
              />
            </div>
          </div>
        </div>

        {/* Contact info column */}
        <div className="lg:col-span-5">
          {directEyebrow && (
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[color:var(--pmbc-primary)]">
              {directEyebrow}
            </p>
          )}
          {directHeading && (
            <h3 className="mt-3 font-serif text-2xl font-semibold tracking-tight text-[color:var(--pmbc-text)]">
              {directHeading}
            </h3>
          )}
          {directIntro && (
            <p className="mt-3 text-[14px] leading-relaxed text-[color:var(--pmbc-muted)]">
              {directIntro}
            </p>
          )}

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

          {/* Founder direct-discussion card. The portrait is read from the
              founder_hero section, so uploading a new one in the page builder
              updates this card with no code change. Clearing its heading, body
              and link label removes the card. */}
          {showFounderCard && (
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
                {founderHeading && (
                  <h4 className="font-serif text-[19px] font-semibold leading-snug tracking-tight text-[color:var(--pmbc-primary)]">
                    {founderHeading}
                  </h4>
                )}
                {founderBody && (
                  <p className="mt-2.5 text-[14px] leading-relaxed text-[color:var(--pmbc-muted)]">
                    {founderBody}
                  </p>
                )}
                {founderCtaLabel && (
                  <Link
                    href="/book"
                    className="group mt-5 inline-flex items-center gap-2 text-[12px] font-semibold uppercase text-[color:var(--pmbc-primary)] transition hover:text-[color:var(--pmbc-accent)]"
                    style={{ letterSpacing: '0.12em' }}
                  >
                    <span className="relative pb-1">
                      {founderCtaLabel}
                      <span
                        aria-hidden
                        className="absolute right-0 bottom-0 left-0 h-px bg-[color:var(--pmbc-accent)]"
                      />
                    </span>
                    <span aria-hidden style={{ color: 'var(--pmbc-accent)' }}>
                      &#8594;
                    </span>
                  </Link>
                )}
              </div>
            </div>
          </div>
          )}
        </div>
      </div>
    </SectionContainer>
  );
}

function s(v: unknown): string {
  return typeof v === 'string' ? v : '';
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
