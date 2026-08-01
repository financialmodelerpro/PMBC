import { redirect } from 'next/navigation';

/**
 * Branding was merged into /admin/header-settings in Phase 1 of the FMP admin
 * parity work, matching FMP where a single "Header Settings" page owns brand
 * colours, logo, branding text, header icon, and header layout.
 *
 * This route stays as a redirect so existing bookmarks, the dashboard
 * quick-action tile, and links in older docs still land somewhere useful
 * rather than 404ing. The sidebar's Header Settings entry carries
 * matchPaths: ['/admin/branding'] so the nav highlights correctly in transit,
 * which is exactly what FMP's own sidebar does.
 */
export default function BrandingRedirectPage() {
  redirect('/admin/header-settings');
}
