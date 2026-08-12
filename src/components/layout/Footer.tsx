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
import {
  DEFAULT_FOOTER_CONFIG,
  type FooterConfig,
} from '@/lib/cms/footerSettings';
import { PAGE_GUTTER, PAGE_INNER } from '@/lib/public/layout';

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
  footerConfig = DEFAULT_FOOTER_CONFIG,
}: {
  brand: FooterBrand;
  footerContent: Record<string, string>;
  settings: SiteSettings;
  /** Logo sizing and visibility. Defaulted so any other caller keeps working. */
  footerConfig?: FooterConfig;
}) {
  const description =
    footerContent.description ||
    'Boutique corporate finance and transaction advisory firm serving KSA, GCC, and worldwide mandates.';

  const copyrightYear = new Date().getFullYear();
  const copyright =
    footerContent.copyright?.replace('{year}', String(copyrightYear)) ||
    `© ${copyrightYear} PaceMakers Business Consultants LLP. All rights reserved.`;

  // Prefer the light logo: this footer sits on deep navy. Disabling the logo
  // falls through to the same PM wordmark that a missing logo shows, so the
  // brand column is never empty.
  const logoSrc = footerConfig.logo_enabled
    ? brand.logoDarkUrl || brand.logoUrl || null
    : null;

  const logoHeight = footerConfig.logo_height_px;
  const logoWidth = footerConfig.logo_width_px;

  return (
    <footer
      className="mt-0 text-[#E8DDC4]"
      style={{ background: '#14304F' }}
    >
      {/* gold hairline */}
      <div
        className="h-px w-full"
        style={{ background: 'rgba(198, 156, 62, 0.45)' }}
      />

      <div className={`${PAGE_GUTTER} py-20`}>
        <div className={PAGE_INNER}>
        <div className="grid gap-14 md:grid-cols-12">
          {/* Brand column */}
          <div className="md:col-span-4">
            <Link href="/" className="inline-flex items-center gap-3">
              {logoSrc ? (
                <Image
                  src={logoSrc}
                  alt={brand.name}
                  // Intrinsic hints only. The rendered size comes from the
                  // inline style below, so the operator's values win without
                  // a Tailwind class needing to know them.
                  width={logoWidth ?? 180}
                  height={logoHeight}
                  style={{
                    height: logoHeight,
                    width: logoWidth ?? 'auto',
                    objectFit: 'contain',
                  }}
                  unoptimized
                />
              ) : (
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-11 w-11 items-center justify-center"
                    style={{
                      background: 'rgba(198, 156, 62, 0.12)',
                      border: '1px solid #C69C3E',
                      color: '#C69C3E',
                      fontFamily: 'var(--font-source-serif), serif',
                      fontWeight: 600,
                      fontSize: 18,
                      letterSpacing: '-0.02em',
                    }}
                  >
                    PM
                  </div>
                  <span className="font-serif text-[20px] font-semibold tracking-tight text-white">
                    {brand.shortName}
                  </span>
                </div>
              )}
            </Link>
            <p
              className="mt-6 max-w-sm text-[14px] leading-[1.7]"
              style={{ color: 'rgba(232, 221, 196, 0.85)' }}
            >
              {description}
            </p>
            <div className="mt-7">
              <div
                aria-hidden
                className="h-px w-[40px]"
                style={{ background: '#C69C3E' }}
              />
              <p
                className="mt-3 text-[11px] font-semibold uppercase italic"
                style={{
                  letterSpacing: '0.18em',
                  color: '#C69C3E',
                  fontFamily: 'var(--font-source-serif), serif',
                  fontStyle: 'italic',
                }}
              >
                {brand.tagline}
              </p>
            </div>
          </div>

          {/* Services */}
          <div className="md:col-span-3">
            <FooterColumnLabel>Services</FooterColumnLabel>
            <ul className="mt-5 space-y-3">
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
            <ul className="mt-5 space-y-3">
              {/* Approach is deliberately absent. The nav item was hidden in
                  Pages & Nav, and a page reachable only from the footer is
                  neither published nor retired. The route still resolves;
                  restoring the nav item is what brings it back. */}
              <li><FooterLink href="/network">Network</FooterLink></li>
              <li><FooterLink href="/sectors">Sectors</FooterLink></li>
              <li><FooterLink href="/case-studies">Case Studies</FooterLink></li>
              <li><FooterLink href="/insights">Insights</FooterLink></li>
              <li><FooterLink href="/about/ahmad-din">Founder</FooterLink></li>
              <li><FooterLink href="/team">Team</FooterLink></li>
              <li><FooterLink href="/fmp">Financial Modeler Pro</FooterLink></li>
              <li><FooterLink href="/contact">Contact</FooterLink></li>
              <li><FooterLink href="/book">Book a Meeting</FooterLink></li>
            </ul>
          </div>

          {/* Contact */}
          <div className="md:col-span-3">
            <FooterColumnLabel>Contact</FooterColumnLabel>
            <ul
              className="mt-5 space-y-4 text-[14px]"
              style={{ color: 'rgba(232, 221, 196, 0.85)' }}
            >
              {settings.contact_email && (
                <li className="flex items-start gap-2.5">
                  <Mail size={14} className="mt-1" style={{ color: '#C69C3E' }} />
                  <a
                    href={`mailto:${settings.contact_email}`}
                    className="transition-colors duration-200 hover:text-white"
                  >
                    {settings.contact_email}
                  </a>
                </li>
              )}
              {settings.whatsapp_number && (
                <li className="flex items-start gap-2.5">
                  <MessageCircle size={14} className="mt-1" style={{ color: '#C69C3E' }} />
                  <a
                    href={`https://wa.me/${settings.whatsapp_number.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="transition-colors duration-200 hover:text-white"
                  >
                    {settings.whatsapp_number}
                  </a>
                </li>
              )}
              {settings.office_location_text && (
                <li className="flex items-start gap-2.5">
                  <MapPin size={14} className="mt-1" style={{ color: '#C69C3E' }} />
                  <span>{settings.office_location_text}</span>
                </li>
              )}
              {settings.social_linkedin && (
                <li className="flex items-start gap-2.5">
                  <span className="mt-1" style={{ color: '#C69C3E' }}>
                    <LinkedInIcon size={14} />
                  </span>
                  <a
                    href={settings.social_linkedin}
                    target="_blank"
                    rel="noreferrer"
                    className="transition-colors duration-200 hover:text-white"
                  >
                    LinkedIn
                  </a>
                </li>
              )}
            </ul>
          </div>
          </div>
        </div>
      </div>

      {/* Bottom strip */}
      <div style={{ borderTop: '1px solid rgba(232, 221, 196, 0.12)' }}>
        <div className={`${PAGE_GUTTER} py-6`}>
          <div
            className={`${PAGE_INNER} flex flex-col items-start justify-between gap-3 text-[12px] sm:flex-row sm:items-center`}
          >
          <p style={{ color: 'rgba(168, 133, 48, 0.85)' }}>{copyright}</p>
          <div className="flex items-center gap-6">
            <Link
              href="/privacy"
              className="transition-colors duration-200 hover:text-white"
              style={{ color: 'rgba(232, 221, 196, 0.7)' }}
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="transition-colors duration-200 hover:text-white"
              style={{ color: 'rgba(232, 221, 196, 0.7)' }}
            >
              Terms
            </Link>
          </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterColumnLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3
      className="text-[11px] font-semibold uppercase"
      style={{
        letterSpacing: '0.2em',
        color: '#C69C3E',
      }}
    >
      {children}
    </h3>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-[14px] transition-colors duration-200 hover:text-white"
      style={{ color: 'rgba(232, 221, 196, 0.85)' }}
    >
      {children}
    </Link>
  );
}
