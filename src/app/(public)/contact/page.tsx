import type { Metadata } from 'next';
import { Mail, MessageCircle, MapPin } from 'lucide-react';

import { fetchPage, fetchPageSections } from '@/lib/cms/pages';
import { fetchSiteSettings } from '@/lib/cms/settings';
import { SectionRenderer } from '@/components/public/SectionRenderer';
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
      title: 'Contact — PaceMakers Business Consultants',
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

  // /services/[slug] CTAs link here as `?service=<slug>` — pre-fill the
  // service-interest dropdown with the matching service title when present.
  const rawService = search.service;
  const serviceSlug = typeof rawService === 'string' ? rawService : '';
  const defaultServiceTitle =
    SERVICES.find((s) => s.slug === serviceSlug)?.title ?? undefined;

  const [sections, settings] = await Promise.all([
    fetchPageSections('contact', { onlyVisible: !isPreview }),
    safe(fetchSiteSettings(), {}),
  ]);

  const hcaptchaSiteKey = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY || null;

  return (
    <>
      {sections.map((s) => (
        <SectionRenderer key={s.id} section={s} />
      ))}

      <section className="bg-[color:var(--pmbc-surface-alt)] px-6 py-24 lg:py-28">
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
                {settings.contact_email && (
                  <ContactRow
                    icon={<Mail size={16} />}
                    label="Email"
                    href={`mailto:${settings.contact_email}`}
                    value={settings.contact_email}
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
            </div>
          </div>
        </div>
      </section>
    </>
  );
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
