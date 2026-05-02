import type { Metadata } from 'next';

import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { fetchSiteSettings } from '@/lib/cms/settings';

import { SettingsForm } from './SettingsForm';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Settings — PMBC Admin',
  robots: { index: false, follow: false },
};

export default async function SettingsAdminPage() {
  const settings = await fetchSiteSettings();
  return (
    <div className="mx-auto max-w-3xl">
      <AdminPageHeader
        eyebrow="Admin"
        title="Site Settings"
        description="Contact details, social links, default OG image, and analytics. Stored as a single JSONB blob."
      />
      <SettingsForm initial={settings} />
    </div>
  );
}
