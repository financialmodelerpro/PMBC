'use client';

import { useSearchParams } from 'next/navigation';

/**
 * Decides whether the testimonial form is shown at all, and hides the whole
 * band when it is not.
 *
 * Two ways in:
 *
 * 1. The public switch in Site Settings is on, in which case the form renders
 *    everywhere it has been placed.
 * 2. The URL carries `?t=`, which is the private-link case. **A token beats the
 *    switch**, because the whole point of sending a client a link is that it
 *    works whether or not the firm is currently soliciting testimonials
 *    publicly.
 *
 * **A client component, because only the browser knows the URL here.** Sections
 * are rendered by a registry that passes no request state, so a server-side
 * decision would have to be threaded through every route that might carry this
 * section, and whichever route was forgotten would break the private link
 * silently. The section it wraps is still server-rendered and arrives as
 * `children`; this only chooses whether to mount it.
 *
 * **Token presence, not token validity.** Checking validity here would mean a
 * round trip and a flash of nothing before the form appeared, and would answer
 * "is this token real" to anyone who asked. The submit route is the real gate:
 * it refuses an unknown or revoked token outright. So a bad token shows a form
 * that then declines to accept the submission, which is the right order for a
 * thing that is far more often a typo than an attack.
 */
export function TestimonialFormGate({
  publicEnabled,
  children,
}: {
  publicEnabled: boolean;
  children: React.ReactNode;
}) {
  const searchParams = useSearchParams();
  const hasToken = (searchParams?.get('t') ?? '').trim() !== '';

  if (!publicEnabled && !hasToken) return null;
  return <>{children}</>;
}
