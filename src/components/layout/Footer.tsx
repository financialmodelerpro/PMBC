import Link from 'next/link';
import Image from 'next/image';
import { Mail, MessageCircle, MapPin } from 'lucide-react';

function LinkedInIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.67H9.35V9h3.42v1.56h.05a3.74 3.74 0 0 1 3.37-1.85c3.6 0 4.27 2.37 4.27 5.45zM5.34 7.43a2.07 2.07 0 1 1 0-4.13 2.07 2.07 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z" />
    </svg>
  );
}

import { SERVICES } from '@/config/services';
import type { SiteSettings } from '@/lib/cms/settings';

type FooterBrand = {
  name: string;
  shortName: string;
  tagline: string;
  logoUrl: string | null;
  logoDarkUrl: string | null;
};

export function Footer({
  brand,
  footerContent,
  settings,
}: {
  brand: FooterBrand;
  footerContent: Record<string, string>;
  settings: SiteSettings;
}) {
  const description =
    footerContent.description ||
    'Boutique corporate finance and transaction advisory firm serving KSA, GCC, and worldwide mandates.';

  const copyrightYear = new Date().getFullYear();
  const copyright =
    footerContent.copyright?.replace('{year}', String(copyrightYear)) ||
    `© ${copyrightYear} PaceMakers Business Consultants LLP. All rights reserved.`;

  const logoSrc = brand.logoDarkUrl || brand.logoUrl || null;

  return (
    <footer className="mt-24 bg-[color:var(--pmbc-primary-deep)] text-[color:var(--pmbc-text-on-dark)]">
      {/* gold hairline */}
      <div className="h-px w-full bg-[color:var(--pmbc-accent)]/40" />

      <div className="mx-auto max-w-[1200px] px-6 py-16">
        <div className="grid gap-12 md:grid-cols-12">
          {/* Brand column */}
          <div className="md:col-span-4">
            <Link href="/" className="inline-flex items-center gap-3">
              {logoSrc ? (
                <Image
                  src={logoSrc}
                  alt={brand.name}
                  width={160}
                  height={40}
                  className="h-10 w-auto"
                  unoptimized
                />
              ) : (
                <span className="font-serif text-xl font-semibold tracking-tight text-white">
                  {brand.shortName}
                </span>
              )}
            </Link>
            <p className="mt-4 max-w-sm text-[13px] leading-relaxed text-[color:var(--pmbc-text-on-dark)]/75">
              {description}
            </p>
            <p className="mt-5 text-[11px] font-medium uppercase tracking-[0.22em] text-[color:var(--pmbc-accent)]">
              {brand.tagline}
            </p>
          </div>

          {/* Services */}
          <div className="md:col-span-3">
            <FooterColumnLabel>Services</FooterColumnLabel>
            <ul className="mt-4 space-y-2.5">
              {SERVICES.map((s) => (
                <li key={s.slug}>
                  <FooterLink href={`/services/${s.slug}`}>{s.title}</FooterLink>
                </li>
              ))}
            </ul>
          </div>

          {/* Firm */}
          <div className="md:col-span-2">
            <FooterColumnLabel>Firm</FooterColumnLabel>
            <ul className="mt-4 space-y-2.5">
              <li><FooterLink href="/approach">Approach</FooterLink></li>
              <li><FooterLink href="/network">Network</FooterLink></li>
              <li><FooterLink href="/sectors">Sectors</FooterLink></li>
              <li><FooterLink href="/about">About</FooterLink></li>
              <li><FooterLink href="/financial-modeler-pro">Financial Modeler Pro</FooterLink></li>
              <li><FooterLink href="/contact">Contact</FooterLink></li>
            </ul>
          </div>

          {/* Contact */}
          <div className="md:col-span-3">
            <FooterColumnLabel>Contact</FooterColumnLabel>
            <ul className="mt-4 space-y-3 text-[13px] text-[color:var(--pmbc-text-on-dark)]/80">
              {settings.contact_email && (
                <li className="flex items-start gap-2">
                  <Mail size={14} className="mt-1 text-[color:var(--pmbc-accent)]" />
                  <a
                    href={`mailto:${settings.contact_email}`}
                    className="hover:text-white"
                  >
                    {settings.contact_email}
                  </a>
                </li>
              )}
              {settings.whatsapp_number && (
                <li className="flex items-start gap-2">
                  <MessageCircle size={14} className="mt-1 text-[color:var(--pmbc-accent)]" />
                  <a
                    href={`https://wa.me/${settings.whatsapp_number.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-white"
                  >
                    {settings.whatsapp_number}
                  </a>
                </li>
              )}
              {settings.office_location_text && (
                <li className="flex items-start gap-2">
                  <MapPin size={14} className="mt-1 text-[color:var(--pmbc-accent)]" />
                  <span>{settings.office_location_text}</span>
                </li>
              )}
              {settings.social_linkedin && (
                <li className="flex items-start gap-2">
                  <span className="mt-1 text-[color:var(--pmbc-accent)]">
                    <LinkedInIcon size={14} />
                  </span>
                  <a
                    href={settings.social_linkedin}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-white"
                  >
                    LinkedIn
                  </a>
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom strip */}
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-[1200px] flex-col items-start justify-between gap-3 px-6 py-6 text-[12px] text-[color:var(--pmbc-text-on-dark)]/60 sm:flex-row sm:items-center">
          <p>{copyright}</p>
          <div className="flex items-center gap-5">
            <Link href="/privacy" className="hover:text-white">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-white">
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterColumnLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/95">
      {children}
    </h3>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-[13px] text-[color:var(--pmbc-text-on-dark)]/75 transition hover:text-white"
    >
      {children}
    </Link>
  );
}
