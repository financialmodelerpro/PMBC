import { resolveShortLink } from '@/lib/tools/bookingRedirect';
import { bookingRedirectResponse } from '@/lib/tools/bookingResponse';
import { bookingRedirectDeps } from '@/lib/tools/leads/bookingLinkStore';

export const dynamic = 'force-dynamic';

/**
 * A short booking link, `/b/<id><channel>`, from a tool's results page, email
 * or PDF. Records the click against the lead, stores the attribution in the
 * first-party cookie, and redirects to /book with no query string. It opens the
 * booking page and nothing else; an unknown or malformed id redirects the same
 * way and records nothing. See `src/lib/tools/bookingLinks.ts`.
 */
export async function GET(req: Request, props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const outcome = await resolveShortLink(slug, req.headers.get('user-agent'), bookingRedirectDeps);
  return bookingRedirectResponse(req, outcome);
}
