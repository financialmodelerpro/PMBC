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

  // Close the mobile menu on every route change.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Lock body scroll while mobile menu open.
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
        'sticky top-0 z-40 w-full border-b transition-all ' +
        (scrolled
          ? 'border-[color:var(--pmbc-border)] bg-white/95 shadow-sm backdrop-blur'
          : 'border-transparent bg-white')
      }
    >
      <div className="mx-auto flex h-[72px] w-full max-w-[1200px] items-center justify-between px-6">
        {/* Brand */}
        <Link
          href="/"
          className="flex items-center gap-3 text-[color:var(--pmbc-primary-deep)] hover:opacity-80"
        >
          {brand.logoUrl ? (
            <Image
              src={brand.logoUrl}
              alt={brand.name}
              width={140}
              height={36}
              className="h-9 w-auto"
              priority
              unoptimized
            />
          ) : (
            <span className="font-serif text-lg font-semibold tracking-tight">
              {brand.shortName}
            </span>
          )}
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-8 md:flex">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  'text-[13.5px] font-medium tracking-wide transition ' +
                  (active
                    ? 'text-[color:var(--pmbc-primary)]'
                    : 'text-[color:var(--pmbc-text)]/80 hover:text-[color:var(--pmbc-primary)]')
                }
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
              className="hidden items-center rounded-md bg-[color:var(--pmbc-primary)] px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-[color:var(--pmbc-primary-deep)] md:inline-flex"
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
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[color:var(--pmbc-border)] text-[color:var(--pmbc-primary-deep)] md:hidden"
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          )}
        </div>
      </div>

      {/* Mobile slide-down */}
      {mobileMenuEnabled && mobileOpen && (
        <div className="border-t border-[color:var(--pmbc-border)] bg-white md:hidden">
          <nav className="mx-auto flex max-w-[1200px] flex-col gap-1 px-6 py-4">
            {navItems.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    'rounded-md px-3 py-2.5 text-[15px] font-medium ' +
                    (active
                      ? 'bg-[color:var(--pmbc-surface-alt)] text-[color:var(--pmbc-primary)]'
                      : 'text-[color:var(--pmbc-text)] hover:bg-[color:var(--pmbc-surface-alt)]')
                  }
                >
                  {item.label}
                </Link>
              );
            })}
            {cta && (
              <Link
                href={cta.href}
                className="mt-2 inline-flex items-center justify-center rounded-md bg-[color:var(--pmbc-primary)] px-4 py-3 text-[14px] font-semibold text-white"
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
