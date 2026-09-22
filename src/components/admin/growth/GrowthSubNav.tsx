'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, type CSSProperties } from 'react';

import { ADMIN_COLORS } from '@/lib/admin/styles';
import { GROWTH_BASE_PATH, GROWTH_PAGES } from '@/lib/growth/pages';

/** Home matches only its own path; every other page also matches its sub-paths. */
function isActive(pathname: string, href: string): boolean {
  if (href === GROWTH_BASE_PATH) return pathname === href;
  return pathname === href || pathname.startsWith(href + '/');
}

const tab: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  flexShrink: 0,
  padding: '7px 14px',
  borderRadius: 999,
  border: '1px solid',
  fontSize: 12,
  fontWeight: 600,
  textDecoration: 'none',
  whiteSpace: 'nowrap',
};

/**
 * The Growth section's own navigation, one pill per page in `GROWTH_PAGES`
 * order. Scrolls sideways on a narrow screen rather than wrapping into rows,
 * bringing the current page's pill into view.
 */
export function GrowthSubNav() {
  const pathname = usePathname() ?? '';
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = navRef.current;
    const active = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    // Only when it overflows, so a wide screen never scrolls the page.
    if (nav && active && nav.scrollWidth > nav.clientWidth) active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [pathname]);
  return (
    <nav ref={navRef} aria-label="Growth sections" style={{ overflowX: 'auto', marginBottom: 24, paddingBottom: 4 }}>
      <ul style={{ display: 'flex', gap: 8, listStyle: 'none', margin: 0, padding: 0 }}>
        {GROWTH_PAGES.map((page) => {
          const active = isActive(pathname, page.href);
          return (
            <li key={page.key} style={{ flexShrink: 0 }}>
              <Link
                href={page.href}
                aria-current={active ? 'page' : undefined}
                style={{
                  ...tab,
                  background: active ? ADMIN_COLORS.primary : ADMIN_COLORS.cardBg,
                  borderColor: active ? ADMIN_COLORS.primary : ADMIN_COLORS.border,
                  color: active ? '#FFFFFF' : ADMIN_COLORS.textBody,
                }}
              >
                {page.title}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
