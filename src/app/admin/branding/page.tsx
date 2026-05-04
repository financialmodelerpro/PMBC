import type { Metadata } from 'next';

import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { fetchBranding } from '@/lib/cms/branding';
import { ADMIN_COLORS, adminPageMain } from '@/lib/admin/styles';

import { BrandingForm } from './BrandingForm';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Branding | PMBC Admin',
  robots: { index: false, follow: false },
};

export default async function BrandingAdminPage() {
  const branding = await fetchBranding();

  return (
    <div style={adminPageMain}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <AdminPageHeader
          eyebrow="Admin"
          title="Branding"
          description="Logos, brand identity, and color tokens. Used everywhere on the public site and in transactional emails."
        />
        {branding ? (
          <BrandingForm initial={branding} />
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
            branding_config row missing. Run migrations 003 and re-seed.
          </div>
        )}
      </div>
    </div>
  );
}
