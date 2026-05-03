import Link from 'next/link';
import type { Metadata } from 'next';

import { NavbarServer } from '@/components/layout/NavbarServer';
import { FooterServer } from '@/components/layout/FooterServer';

export const metadata: Metadata = {
  title: 'Page not found',
  robots: { index: false, follow: false },
};

/**
 * Catches URLs that don't match any segment (the route-group `(public)/`
 * not-found.tsx only triggers from within that group). Mounts the same
 * Navbar/Footer chrome manually since we sit outside the public layout.
 */
export default function RootNotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-[color:var(--pmbc-surface)] text-[color:var(--pmbc-text)]">
      <NavbarServer />
      <main className="flex-1">
        <section className="px-6 py-28 lg:py-36">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-[11px] font-semibold tracking-[0.22em] uppercase text-[color:var(--pmbc-primary)]">
              404 · Not found
            </p>
            <h1 className="mt-4 font-serif text-4xl font-semibold tracking-tight text-[color:var(--pmbc-text)] sm:text-5xl">
              We couldn&apos;t find that page
            </h1>
            <p className="mt-5 text-base leading-relaxed text-neutral-600 sm:text-lg">
              The link may be out of date, or the page may have moved. Either way,
              you can pick up from one of the doors below.
            </p>

            <div
              aria-hidden
              className="mx-auto mt-10 h-px w-16 bg-[color:var(--pmbc-accent)]"
            />

            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/"
                className="inline-flex items-center rounded-md bg-[color:var(--pmbc-primary)] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[color:var(--pmbc-primary-deep)]"
              >
                Back to home
              </Link>
              <Link
                href="/services"
                className="inline-flex items-center rounded-md border border-[color:var(--pmbc-border)] px-5 py-2.5 text-sm font-medium text-[color:var(--pmbc-text)] transition hover:border-[color:var(--pmbc-primary)] hover:text-[color:var(--pmbc-primary)]"
              >
                See services
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center rounded-md border border-[color:var(--pmbc-border)] px-5 py-2.5 text-sm font-medium text-[color:var(--pmbc-text)] transition hover:border-[color:var(--pmbc-primary)] hover:text-[color:var(--pmbc-primary)]"
              >
                Contact PMBC
              </Link>
            </div>
          </div>
        </section>
      </main>
      <FooterServer />
    </div>
  );
}
