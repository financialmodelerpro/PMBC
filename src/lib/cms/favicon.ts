import { createSupabaseServerClient } from '@/lib/supabase/server';
import { extensionOf } from '@/lib/media';

/**
 * Resolves the browser-tab icon from the CMS.
 *
 * Until this module existed, nothing read any of it: the root layout declared no
 * `icons` at all, so `branding_config.favicon_url` was stored, editable and
 * consumed by nobody, while `src/app/favicon.ico` (the untouched create-next-app
 * default, a Next.js logo) was the icon the public site actually served.
 *
 * Resolution order, first non-empty wins:
 *
 *   1. `branding_config.favicon_url`        the field labelled Favicon in admin
 *   2. `header_settings.icon_url`           only when `icon_as_favicon` is true
 *   3. `branding_config.logo_url`           so a brand that set only a logo
 *                                           still gets a branded tab
 *
 * The favicon field is checked before the header icon even though the header
 * icon carries an explicit "Use as favicon" toggle. The dedicated field is the
 * more specific statement of intent, and it is what an operator looking for
 * "the favicon" will have filled in; the toggle is a convenience for reusing an
 * icon already uploaded for the header.
 */

const MIME_BY_EXT: Record<string, string> = {
  ico: 'image/x-icon',
  png: 'image/png',
  svg: 'image/svg+xml',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
};

/** `type` hint for the `<link>`. Undefined for an unknown extension, which is valid. */
export function faviconMimeType(url: string): string | undefined {
  return MIME_BY_EXT[extensionOf(url)];
}

function clean(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/**
 * Never throws and never rejects.
 *
 * This runs inside the root layout's `generateMetadata`, so an unhandled error
 * here would fail metadata generation for every page on the site, and would
 * fail the production build. A missing icon is a cosmetic problem; a thrown
 * error is an outage. Returns null when nothing is configured or the read
 * fails, and the layout then emits no `icons` at all.
 */
export async function resolveFaviconUrl(): Promise<string | null> {
  try {
    const supabase = createSupabaseServerClient();
    const [brandingRes, headerRes] = await Promise.all([
      supabase.from('branding_config').select('favicon_url, logo_url').eq('id', 1).maybeSingle(),
      supabase
        .from('cms_content')
        .select('key, value')
        .eq('section', 'header_settings')
        .in('key', ['icon_url', 'icon_as_favicon']),
    ]);

    const branding = brandingRes.data;
    const rows = new Map((headerRes.data ?? []).map((r) => [r.key, r.value]));

    const favicon = clean(branding?.favicon_url);
    if (favicon) return favicon;

    if (rows.get('icon_as_favicon') === 'true') {
      const icon = clean(rows.get('icon_url'));
      if (icon) return icon;
    }

    return clean(branding?.logo_url) || null;
  } catch {
    return null;
  }
}
