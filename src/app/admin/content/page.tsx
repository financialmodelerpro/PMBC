import type { Metadata } from 'next';

import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { fetchAllContent } from '@/lib/cms/content';
import { adminPageMain } from '@/lib/admin/styles';

import { ContentEditor } from './ContentEditor';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Content — PMBC Admin',
  robots: { index: false, follow: false },
};

export default async function ContentAdminPage() {
  // Header navigation lives in cms_content under (header_settings, nav_items) but
  // is edited via the dedicated /admin/header-settings UI. Hide that one row here
  // to avoid double-editing.
  const all = await fetchAllContent();
  const visible = all.filter(
    (r) => !(r.section === 'header_settings' && r.key === 'nav_items'),
  );

  return (
    <div style={adminPageMain}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <AdminPageHeader
          eyebrow="Admin"
          title="Content"
          description="Key-value content for the public site. Grouped by section. Header navigation is edited under Header Settings."
        />
        <ContentEditor initial={visible} />
      </div>
    </div>
  );
}
