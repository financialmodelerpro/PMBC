'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

/**
 * Error boundary for the public route group. Catches unhandled errors
 * thrown during server or client rendering and presents a calm, on-brand
 * fallback. Renders inside the (public) layout, so the Navbar and Footer
 * stay visible.
 */
export default function PublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the digest so the operator can correlate with server logs.
    if (error.digest) {
      console.error('[public error]', error.digest, error.message);
    } else {
      console.error('[public error]', error);
    }
  }, [error]);

  return (
    <section className="px-6 py-28 lg:py-36">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-[11px] font-semibold tracking-[0.22em] uppercase text-[color:var(--pmbc-primary)]">
          Something went wrong
        </p>
        <h1 className="mt-4 font-serif text-4xl font-semibold tracking-tight text-[color:var(--pmbc-text)] sm:text-5xl">
          We hit an unexpected snag
        </h1>
        <p className="mt-5 text-base leading-relaxed text-neutral-600 sm:text-lg">
          The page didn&apos;t load as expected. Try again — and if the issue
          persists, let us know and we&apos;ll look into it.
        </p>

        {error.digest && (
          <p className="mt-3 text-xs font-mono text-neutral-400">
            Reference: {error.digest}
          </p>
        )}

        <div
          aria-hidden
          className="mx-auto mt-10 h-px w-16 bg-[color:var(--pmbc-accent)]"
        />

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1.5 rounded-md bg-[color:var(--pmbc-primary)] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[color:var(--pmbc-primary-deep)]"
          >
            <RefreshCw size={14} />
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex items-center rounded-md border border-[color:var(--pmbc-border)] px-5 py-2.5 text-sm font-medium text-[color:var(--pmbc-text)] transition hover:border-[color:var(--pmbc-primary)] hover:text-[color:var(--pmbc-primary)]"
          >
            Back to home
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
  );
}
