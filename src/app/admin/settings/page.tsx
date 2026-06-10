import type { Metadata } from 'next';

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
        <SettingsForm initial={settings} />
      </div>
    </div>
  );
}
