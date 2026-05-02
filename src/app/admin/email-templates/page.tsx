import type { Metadata } from 'next';

import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { fetchEmailTemplates } from '@/lib/cms/emailTemplates';
import { adminPageMain } from '@/lib/admin/styles';

import { EmailTemplatesEditor } from './EmailTemplatesEditor';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Email Templates — PMBC Admin',
  robots: { index: false, follow: false },
};

export default async function EmailTemplatesPage() {
  const templates = await fetchEmailTemplates();
  return (
    <div style={adminPageMain}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <AdminPageHeader
          eyebrow="Admin"
          title="Email Templates"
          description="Subject and body for transactional messages. Variables in double-braces are substituted at send time."
        />
        <EmailTemplatesEditor initial={templates} />
      </div>
    </div>
  );
}
