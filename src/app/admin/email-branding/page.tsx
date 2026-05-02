import type { Metadata } from 'next';

import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { fetchEmailBranding } from '@/lib/cms/emailBranding';

import { EmailBrandingForm } from './EmailBrandingForm';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Email Branding — PMBC Admin',
  robots: { index: false, follow: false },
};

export default async function EmailBrandingPage() {
  const branding = await fetchEmailBranding();
  return (
    <div className="mx-auto max-w-6xl">
      <AdminPageHeader
        eyebrow="Admin"
        title="Email Branding"
        description="Header logo, accent color, and reusable signature/footer HTML for transactional emails."
      />
      {branding ? (
        <EmailBrandingForm initial={branding} />
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          email_branding row missing. Run migration 004 and re-seed.
        </div>
      )}
    </div>
  );
}
