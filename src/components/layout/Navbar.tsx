'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';

import { PAGE_GUTTER, PAGE_INNER } from '@/lib/public/layout';
import {
  DEFAULT_HEADER_BACKGROUND,
  headerSurface,
  type HeaderBackground,
} from '@/lib/public/headerSurface';
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
  /** The surface the header sits on. See lib/public/headerSurface.ts. */
  headerBackground: HeaderBackground;
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
  headerBackground: DEFAULT_HEADER_BACKGROUND,
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
  const surface = headerSurface(p.headerBackground);

  // On a dark header the standard navy and green logo disappears into the
  // background, so the light version is used when one has been uploaded. Left
  // empty it falls back to the standard logo rather than to nothing, which is
  // the same chain the footer uses.
  const logoSrc = surface.dark ? brand.logoDarkUrl || brand.logoUrl : brand.logoUrl;

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

  const showWordmark = !p.logoEnabled || !logoSrc;

  return (
    <header
      className={'sticky top-0 z-40 w-full transition-all duration-200 ' + (scrolled ? 'backdrop-blur' : '')}
      style={
        {
          background: scrolled ? surface.bgScrolled : surface.bg,
          boxShadow: scrolled ? surface.shadowScrolled : undefined,
          borderBottom: scrolled
            ? `1px solid ${surface.borderScrolled}`
            : '1px solid transparent',
          // Link colours travel to the nav items and to the dropdown trigger as
          // inherited custom properties rather than as props. The trigger lives
          // inside NavDropdown, which knows nothing about the header's surface
          // and should not have to: hover and focus states are a stylesheet
          // concern, and threading four colours through a component to set them
          // in JavaScript would mean reimplementing :hover by hand.
          '--pmbc-header-link': surface.link,
          '--pmbc-header-link-active': surface.linkActive,
          '--pmbc-header-link-muted': surface.linkMuted,
        } as CSSProperties
      }
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
              src={logoSrc as string}
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
                  background: surface.monogramBg,
                  color: surface.monogramText,
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
                    className="font-serif text-[18px] font-semibold tracking-tight"
                    style={{ letterSpacing: '-0.01em', color: surface.wordmark }}
                  >
                    {brand.shortName}
                  </span>
                  {p.showTagline && brand.tagline && (
                    <span
                      className="text-[11px]"
                      style={{
                        letterSpacing: '0.04em',
                        lineHeight: 1.3,
                        color: surface.tagline,
                      }}
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
                    ? 'text-[color:var(--pmbc-header-link-active)]'
                    : 'text-[color:var(--pmbc-header-link)] hover:text-[color:var(--pmbc-header-link-active)]')
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
              className="hidden items-center justify-center px-5 py-2.5 text-[12px] font-semibold uppercase transition-all duration-200 md:inline-flex"
              style={{
                background: surface.ctaBg,
                color: surface.ctaText,
                letterSpacing: '0.12em',
                border: `1px solid ${surface.ctaBorder}`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = surface.ctaHoverBg;
                e.currentTarget.style.borderColor = surface.ctaHoverBorder;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = surface.ctaBg;
                e.currentTarget.style.borderColor = surface.ctaBorder;
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
              className="inline-flex h-10 w-10 items-center justify-center transition-colors duration-200 hover:text-[color:var(--pmbc-accent)] md:hidden"
              style={{
                color: surface.toggleText,
                border: `1px solid ${surface.toggleBorder}`,
              }}
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
            background: surface.menuBg,
            borderTop: `1px solid ${surface.menuBorder}`,
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
                      color: active ? surface.menuActiveText : surface.menuText,
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
                            color: isActive(child.href)
                              ? surface.menuActiveText
                              : surface.menuChildText,
                            borderLeft: `1px solid ${surface.menuChildBorder}`,
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
                className="mt-3 inline-flex items-center justify-center px-4 py-3 text-[12px] font-semibold uppercase"
                style={{
                  background: surface.ctaBg,
                  color: surface.ctaText,
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
