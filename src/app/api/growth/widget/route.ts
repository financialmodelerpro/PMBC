import { widgetScript } from '@/lib/growth/widgetScript';

export const dynamic = 'force-static';

/**
 * The website chat widget script (Unit 4.2, 2026-09-23). Only ever requested
 * by a page when the chat is switched on (ChatWidgetMount) or by the admin
 * preview; on its own it does nothing but wait to be clicked, and every
 * request it makes goes to an endpoint that refuses while the chat is off.
 */
export function GET() {
  return new Response(widgetScript(), {
    headers: { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'public, max-age=300', 'x-robots-tag': 'noindex' },
  });
}
