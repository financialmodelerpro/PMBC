import type { Metadata } from 'next';

import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { fetchAllContent } from '@/lib/cms/content';

import { ContentEditor } from './ContentEditor';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Content — PMBC Admin',
  robots: { index: false, follow: false },
};

export default async function ContentAdminPage() {
  // Header settings live in cms_content too, but they're managed via /admin/header-settings
  // because the value is a JSON blob. Hide that single key here to avoid confusion.
  const all = await fetchAllContent();
  const visible = all.filter(
    (r) => !(r.section === 'header_settings' && r.key === 'config'),
  );

  return (
    <div className="mx-auto max-w-5xl">
      <AdminPageHeader
        eyebrow="Admin"
        title="Content"
        description="Key-value content for the public site. Grouped by section. Header navigation is edited under Header Settings."
      />
      <ContentEditor initial={visible} />
    </div>
  );
}
