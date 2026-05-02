import type { Metadata } from 'next';

import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { fetchEmailTemplates } from '@/lib/cms/emailTemplates';

import { EmailTemplatesEditor } from './EmailTemplatesEditor';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Email Templates — PMBC Admin',
  robots: { index: false, follow: false },
};

export default async function EmailTemplatesPage() {
  const templates = await fetchEmailTemplates();
  return (
    <div className="mx-auto max-w-6xl">
      <AdminPageHeader
        eyebrow="Admin"
        title="Email Templates"
        description="Subject and body for transactional messages. Variables in double-braces are substituted at send time."
      />
      <EmailTemplatesEditor initial={templates} />
    </div>
  );
}
