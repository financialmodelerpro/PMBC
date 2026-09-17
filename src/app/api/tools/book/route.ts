import { resolveLegacyLink } from '@/lib/tools/bookingRedirect';
import { bookingRedirectResponse } from '@/lib/tools/bookingResponse';
import { bookingRedirectDeps } from '@/lib/tools/leads/bookingLinkStore';

export const dynamic = 'force-dynamic';

/**
 * The long tracked booking link, `/api/tools/book?t=<token>&src=<channel>`.
 *
 * New results pages, emails and PDFs carry the short link (`/b/<id><channel>`)
 * instead; this stays for the emails and PDFs already sent. It behaves the same
 * way: the click is recorded against the lead, the attribution goes into the
 * first-party cookie (with the lead's short link id as the reference, never the
 * token), and the visitor lands on /book with no query string. An unknown or
 * missing token still redirects, recording nothing, so a stale link is never a
 * dead end. Never an open redirect: the destination is always /book.
 *
 * Email security scanners sometimes open links before a person does; a click
 * from the email is judged by `classifyBookingClick` before it is counted.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const outcome = await resolveLegacyLink(url.searchParams.get('t') ?? '', url.searchParams.get('src'), req.headers.get('user-agent'), bookingRedirectDeps);
  return bookingRedirectResponse(req, outcome);
}
