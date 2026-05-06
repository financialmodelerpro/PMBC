'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';

export type NavbarBrand = {
  name: string;
  shortName: string;
  logoUrl: string | null;
  logoDarkUrl: string | null;
};

export type NavbarItem = { label: string; href: string };

export function Navbar({
  brand,
  navItems,
  cta,
  mobileMenuEnabled,
}: {
  brand: NavbarBrand;
  navItems: NavbarItem[];
  cta: { label: string; href: string } | null;
  mobileMenuEnabled: boolean;
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
          ? '1px solid rgba(212, 169, 58, 0.18)'
          : '1px solid transparent',
      }}
    >
      <div className="mx-auto flex h-[80px] w-full max-w-[1280px] items-center justify-between px-6 lg:px-8">
        {/* Brand */}
        <Link
          href="/"
          className="flex items-center gap-3 transition-opacity duration-200 hover:opacity-80"
        >
          {brand.logoUrl ? (
            <Image
              src={brand.logoUrl}
              alt={brand.name}
              width={160}
              height={40}
              className="h-10 w-auto"
              priority
              unoptimized
            />
          ) : (
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center"
                style={{
                  background: '#153D64',
                  color: '#D4A93A',
                  fontFamily: 'var(--font-source-serif), serif',
                  fontWeight: 600,
                  fontSize: 18,
                  letterSpacing: '-0.02em',
                }}
              >
                PM
              </div>
              <span
                className="font-serif text-[18px] font-semibold tracking-tight text-[color:var(--pmbc-primary-deep)]"
                style={{ letterSpacing: '-0.01em' }}
              >
                {brand.shortName}
              </span>
            </div>
          )}
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-9 md:flex">
          {navItems.map((item) => {
            const active = isActive(item.href);
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
        <div className="flex items-center gap-3">
          {cta && (
            <Link
              href={cta.href}
              className="hidden items-center justify-center px-5 py-2.5 text-[12px] font-semibold uppercase text-white transition-all duration-200 md:inline-flex"
              style={{
                background: '#153D64',
                letterSpacing: '0.12em',
                border: '1px solid #153D64',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#0F2F4F';
                e.currentTarget.style.borderColor = '#D4A93A';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#153D64';
                e.currentTarget.style.borderColor = '#153D64';
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

      {/* Mobile slide-down */}
      {mobileMenuEnabled && mobileOpen && (
        <div
          className="md:hidden"
          style={{
            background: '#FAF7F2',
            borderTop: '1px solid var(--pmbc-border-warm)',
          }}
        >
          <nav className="mx-auto flex max-w-[1280px] flex-col gap-1 px-6 py-5">
            {navItems.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="px-3 py-3 text-[15px] font-medium transition-colors duration-200"
                  style={{
                    color: active ? '#153D64' : '#0F1B2D',
                    borderLeft: active ? '2px solid #D4A93A' : '2px solid transparent',
                    paddingLeft: active ? 14 : 12,
                  }}
                >
                  {item.label}
                </Link>
              );
            })}
            {cta && (
              <Link
                href={cta.href}
                className="mt-3 inline-flex items-center justify-center px-4 py-3 text-[12px] font-semibold uppercase text-white"
                style={{
                  background: '#153D64',
                  letterSpacing: '0.12em',
                }}
              >
                {cta.label}
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
