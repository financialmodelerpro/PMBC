import type { Metadata } from 'next';

import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { fetchSiteSettings } from '@/lib/cms/settings';
import { adminPageMain } from '@/lib/admin/styles';

import { SettingsForm } from './SettingsForm';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Settings | PMBC Admin',
  robots: { index: false, follow: false },
};

export default async function SettingsAdminPage() {
  const settings = await fetchSiteSettings();
  return (
    <div style={adminPageMain}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <AdminPageHeader
          eyebrow="Admin"
          title="Site Settings"
          description="Contact details, social links, default OG image, and analytics. Stored as a single JSONB blob."
        />
        <SettingsForm initial={settings} />
      </div>
    </div>
  );
}
