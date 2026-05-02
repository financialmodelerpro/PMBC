import type { Metadata } from 'next';

import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { fetchHeaderConfig } from '@/lib/cms/headerSettings';

import { HeaderSettingsForm } from './HeaderSettingsForm';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Header Settings — PMBC Admin',
  robots: { index: false, follow: false },
};

export default async function HeaderSettingsPage() {
  const config = await fetchHeaderConfig();
  return (
    <div className="mx-auto max-w-3xl">
      <AdminPageHeader
        eyebrow="Admin"
        title="Header Settings"
        description="Public navigation items, call-to-action button, and mobile menu behaviour. Drag to reorder."
      />
      <HeaderSettingsForm initial={config} />
    </div>
  );
}
