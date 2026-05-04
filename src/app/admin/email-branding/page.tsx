import type { Metadata } from 'next';

import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { fetchEmailBranding } from '@/lib/cms/emailBranding';
import { ADMIN_COLORS, adminPageMain } from '@/lib/admin/styles';

import { EmailBrandingForm } from './EmailBrandingForm';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Email Branding | PMBC Admin',
  robots: { index: false, follow: false },
};

export default async function EmailBrandingPage() {
  const branding = await fetchEmailBranding();
  return (
    <div style={adminPageMain}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <AdminPageHeader
          eyebrow="Admin"
          title="Email Branding"
          description="Header logo, accent color, and reusable signature/footer HTML for transactional emails."
        />
        {branding ? (
          <EmailBrandingForm initial={branding} />
        ) : (
          <div
            style={{
              background: ADMIN_COLORS.warningBg,
              border: '1px solid #FBBF24',
              borderRadius: 12,
              padding: 18,
              fontSize: 13,
              color: ADMIN_COLORS.warning,
            }}
          >
            email_branding row missing. Run migration 004 and re-seed.
          </div>
        )}
      </div>
    </div>
  );
}
