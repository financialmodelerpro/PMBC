'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';

import { PAGE_GUTTER, PAGE_INNER } from '@/lib/public/layout';
import { NavDropdown, type DropdownItem } from './NavDropdown';

export type NavbarBrand = {
  name: string;
  shortName: string;
  tagline: string | null;
  logoUrl: string | null;
  logoDarkUrl: string | null;
};

export type NavbarItem = { label: string; href: string };

/**
 * Child links for a nav item, keyed by that item's href.
 *
 * Keyed by href rather than label so a rename in Pages & Nav does not silently
 * drop the menu: the label is operator-editable, the destination is what the
 * children actually belong to.
 */
export type NavbarDropdowns = Record<string, DropdownItem[]>;

/**
 * Header presentation, driven by cms_content section='header_settings' and
 * edited at /admin/header-settings. Numeric fields are null when unset so the
 * defaults below stay authoritative: a blank admin field must never render a
 * zero-height header or a zero-height logo.
 */
export type NavbarPresentation = {
  headerHeightPx: number | null;
  headerPaddingTopPx: number | null;
  headerPaddingBottomPx: number | null;
  headerLayout: 'default' | 'centered' | 'spread';
  logoEnabled: boolean;
  logoHeightPx: number | null;
  logoWidthPx: number | null;
  logoPosition: 'left' | 'center' | 'right';
  showBrandName: boolean;
  showTagline: boolean;
  iconUrl: string | null;
  iconSizePx: number | null;
};

/** The values the navbar shipped with before these fields were wired up. */
const PRESENTATION_DEFAULTS: NavbarPresentation = {
  headerHeightPx: 80,
  headerPaddingTopPx: null,
  headerPaddingBottomPx: null,
  headerLayout: 'default',
  logoEnabled: true,
  logoHeightPx: 40,
  logoWidthPx: null,
  logoPosition: 'left',
  showBrandName: true,
  showTagline: false,
  iconUrl: null,
  iconSizePx: 20,
};

export function Navbar({
  brand,
  navItems,
  cta,
  mobileMenuEnabled,
  presentation,
  dropdowns = {},
}: {
  brand: NavbarBrand;
  navItems: NavbarItem[];
  cta: { label: string; href: string } | null;
  mobileMenuEnabled: boolean;
  presentation?: Partial<NavbarPresentation>;
  dropdowns?: NavbarDropdowns;
}) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (mobileOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [mobileOpen]);

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(href + '/');
  };

  // Merge admin settings over the shipped defaults. A null inside `presentation`
  // means "not set", so it must not win over the default: `??` per field rather
  // than a plain spread, which would let null through.
  const p: NavbarPresentation = {
    ...PRESENTATION_DEFAULTS,
    ...presentation,
    headerHeightPx:
      presentation?.headerHeightPx ?? PRESENTATION_DEFAULTS.headerHeightPx,
    logoHeightPx: presentation?.logoHeightPx ?? PRESENTATION_DEFAULTS.logoHeightPx,
    iconSizePx: presentation?.iconSizePx ?? PRESENTATION_DEFAULTS.iconSizePx,
  };

  const logoHeight = p.logoHeightPx ?? 40;
  const iconSize = p.iconSizePx ?? 20;

  // Brand placement inside the header row, driven by logo_position:
  //   left   brand, nav, actions   (default)
  //   center nav, brand, actions   brand centred by auto side margins
  //   right  nav, actions, brand
  const brandOrder = p.logoPosition === 'left' ? 1 : p.logoPosition === 'center' ? 2 : 3;
  const navOrder = p.logoPosition === 'left' ? 2 : 1;
  const actionsOrder = p.logoPosition === 'right' ? 2 : 3;

  // header_layout controls how nav links distribute. Desktop only: the mobile
  // menu is always a stacked list.
  const navFlex =
    p.headerLayout === 'centered'
      ? { flex: 1, justifyContent: 'center' as const }
      : p.headerLayout === 'spread'
        ? { flex: 1, justifyContent: 'space-around' as const }
        : {};

  const showWordmark = !p.logoEnabled || !brand.logoUrl;

  return (
    <header
      className={
        'sticky top-0 z-40 w-full transition-all duration-200 ' +
        (scrolled
          ? 'bg-white/95 shadow-[0_2px_12px_rgba(15,37,64,0.06)] backdrop-blur'
          : 'bg-white')
      }
      style={{
        borderBottom: scrolled
          ? '1px solid rgba(198, 156, 62, 0.18)'
          : '1px solid transparent',
      }}
    >
      {/* Gutter outside, max width inside, matching SectionContainer exactly so
          the logo's left edge lands on the same x as the content below it. */}
      <div className={PAGE_GUTTER}>
        <div
          className={`${PAGE_INNER} flex items-center justify-between`}
          style={{
            minHeight: p.headerHeightPx ?? 80,
            paddingTop: p.headerPaddingTopPx ?? undefined,
            paddingBottom: p.headerPaddingBottomPx ?? undefined,
          }}
        >
        {/* Brand */}
        <Link
          href="/"
          className="flex items-center gap-3 transition-opacity duration-200 hover:opacity-80"
          style={{
            order: brandOrder,
            marginLeft: p.logoPosition === 'center' ? 'auto' : undefined,
            marginRight: p.logoPosition === 'center' ? 'auto' : undefined,
          }}
        >
          {p.iconUrl && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={p.iconUrl}
              alt=""
              aria-hidden
              style={{ height: iconSize, width: 'auto', objectFit: 'contain' }}
            />
          )}
          {!showWordmark ? (
            <Image
              src={brand.logoUrl as string}
              alt={brand.name}
              width={p.logoWidthPx ?? 160}
              height={logoHeight}
              className="w-auto"
              style={{
                height: logoHeight,
                maxWidth: p.logoWidthPx ?? undefined,
                objectFit: 'contain',
              }}
              priority
              unoptimized
            />
          ) : (
            <div className="flex items-center gap-3">
              <div
                className="flex items-center justify-center"
                style={{
                  height: logoHeight,
                  width: logoHeight,
                  background: '#1B3A5F',
                  color: '#C69C3E',
                  fontFamily: 'var(--font-source-serif), serif',
                  fontWeight: 600,
                  fontSize: Math.max(12, Math.round(logoHeight * 0.45)),
                  letterSpacing: '-0.02em',
                }}
              >
                PM
              </div>
              {p.showBrandName && (
                <div className="flex flex-col">
                  <span
                    className="font-serif text-[18px] font-semibold tracking-tight text-[color:var(--pmbc-primary-deep)]"
                    style={{ letterSpacing: '-0.01em' }}
                  >
                    {brand.shortName}
                  </span>
                  {p.showTagline && brand.tagline && (
                    <span
                      className="text-[11px] text-[color:var(--pmbc-muted)]"
                      style={{ letterSpacing: '0.04em', lineHeight: 1.3 }}
                    >
                      {brand.tagline}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </Link>

        {/* Desktop nav */}
        <nav
          className="hidden items-center gap-9 md:flex"
          style={{ order: navOrder, ...navFlex }}
        >
          {navItems.map((item) => {
            const active = isActive(item.href);
            const children = dropdowns[item.href];
            if (children && children.length > 0) {
              return (
                <NavDropdown
                  key={item.href}
                  label={item.label}
                  href={item.href}
                  items={children}
                  active={active}
                />
              );
            }
            return (
              <Link
                key={item.href}
                href={item.href}
                data-active={active ? 'true' : undefined}
                className={
                  'pmbc-link-underline text-[13px] font-medium uppercase transition-colors duration-200 ' +
                  (active
                    ? 'text-[color:var(--pmbc-primary)]'
                    : 'text-[color:var(--pmbc-text)] hover:text-[color:var(--pmbc-primary)]')
                }
                style={{ letterSpacing: '0.08em' }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* CTA + mobile toggle */}
        <div className="flex items-center gap-3" style={{ order: actionsOrder }}>
          {cta && (
            <Link
              href={cta.href}
              className="hidden items-center justify-center px-5 py-2.5 text-[12px] font-semibold uppercase text-white transition-all duration-200 md:inline-flex"
              style={{
                background: '#1B3A5F',
                letterSpacing: '0.12em',
                border: '1px solid #1B3A5F',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#14304F';
                e.currentTarget.style.borderColor = '#C69C3E';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#1B3A5F';
                e.currentTarget.style.borderColor = '#1B3A5F';
              }}
            >
              {cta.label}
            </Link>
          )}
          {mobileMenuEnabled && (
            <button
              type="button"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((v) => !v)}
              className="inline-flex h-10 w-10 items-center justify-center text-[color:var(--pmbc-primary-deep)] transition-colors duration-200 hover:text-[color:var(--pmbc-accent)] md:hidden"
              style={{ border: '1px solid var(--pmbc-border)' }}
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          )}
          </div>
        </div>
      </div>

      {/* Mobile slide-down */}
      {mobileMenuEnabled && mobileOpen && (
        <div
          className="md:hidden"
          style={{
            background: '#FAF7F2',
            borderTop: '1px solid var(--pmbc-border-warm)',
          }}
        >
          <nav className={`${PAGE_GUTTER} py-5`}>
            <div className={`${PAGE_INNER} flex flex-col gap-1`}>
            {navItems.map((item) => {
              const active = isActive(item.href);
              const children = dropdowns[item.href];
              return (
                <div key={item.href} className="flex flex-col">
                  <Link
                    href={item.href}
                    className="px-3 py-3 text-[15px] font-medium transition-colors duration-200"
                    style={{
                      color: active ? '#1B3A5F' : '#0F1B2D',
                      borderLeft: active ? '2px solid #C69C3E' : '2px solid transparent',
                      paddingLeft: active ? 14 : 12,
                    }}
                  >
                    {item.label}
                  </Link>
                  {/* Children are listed under the parent rather than behind a
                      second tap. The mobile menu is a stacked list with room to
                      scroll, so an accordion would add a control and hide the
                      nine destinations it exists to reveal. */}
                  {children && children.length > 0 && (
                    <div className="mb-1 flex flex-col" style={{ paddingLeft: 18 }}>
                      {children.map((child) => (
                        <Link
                          key={child.href}
                          href={child.href}
                          className="px-3 py-2 text-[14px] transition-colors duration-200"
                          style={{
                            color: isActive(child.href) ? '#1B3A5F' : '#52606B',
                            borderLeft: '1px solid rgba(198, 156, 62, 0.35)',
                          }}
                        >
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {cta && (
              <Link
                href={cta.href}
                className="mt-3 inline-flex items-center justify-center px-4 py-3 text-[12px] font-semibold uppercase text-white"
                style={{
                  background: '#1B3A5F',
                  letterSpacing: '0.12em',
                }}
              >
                {cta.label}
              </Link>
            )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
