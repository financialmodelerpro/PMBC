import type { Metadata } from 'next';

import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { fetchBranding } from '@/lib/cms/branding';
import { fetchHeaderConfig } from '@/lib/cms/headerSettings';
import { fetchContentBySection } from '@/lib/cms/content';
import { parseFooterConfig } from '@/lib/cms/footerSettings';
import { adminPageMain } from '@/lib/admin/styles';

import { HeaderSettingsForm } from './HeaderSettingsForm';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Header Settings | PMBC Admin',
  robots: { index: false, follow: false },
};

export default async function HeaderSettingsPage() {
  // Both sources load in parallel, mirroring FMP, which fetches
  // /api/admin/content and /api/branding together on mount.
  const [header, branding, footerRows] = await Promise.all([
    fetchHeaderConfig(),
    safeFetchBranding(),
    safeFetchFooterRows(),
  ]);
  const footer = parseFooterConfig(footerRows);

  return (
    <div style={adminPageMain}>
      {/* FMP caps this form at 680px. PMBC uses 760 because the colour row is
          three columns wide (primary/secondary/accent) where FMP has two. */}
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <AdminPageHeader
          eyebrow="Content"
          title="Header Settings"
          description="Brand colours, logo, branding text, header icon, header layout, and footer logo. Applies across every public page."
        />
        <HeaderSettingsForm
          initialHeader={header}
          initialBranding={branding}
          initialFooter={footer}
        />
      </div>
    </div>
  );
}

async function safeFetchBranding() {
  try {
    return await fetchBranding();
  } catch {
    return null;
  }
}

async function safeFetchFooterRows(): Promise<Record<string, string>> {
  try {
    return await fetchContentBySection('footer_settings');
  } catch {
    // parseFooterConfig turns an empty map into the shipped defaults, so a
    // failed read shows correct values rather than blank inputs.
    return {};
  }
}
