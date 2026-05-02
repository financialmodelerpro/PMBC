import type { Metadata } from 'next';

import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { fetchHeaderConfig } from '@/lib/cms/headerSettings';
import { adminPageMain } from '@/lib/admin/styles';

import { HeaderSettingsForm } from './HeaderSettingsForm';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Header Settings — PMBC Admin',
  robots: { index: false, follow: false },
};

export default async function HeaderSettingsPage() {
  const config = await fetchHeaderConfig();
  return (
    <div style={adminPageMain}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <AdminPageHeader
          eyebrow="Admin"
          title="Header Settings"
          description="Public navigation items, call-to-action button, and mobile menu behaviour. Drag to reorder."
        />
        <HeaderSettingsForm initial={config} />
      </div>
    </div>
  );
}
