import type { Metadata } from 'next';

import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { fetchBranding } from '@/lib/cms/branding';

import { BrandingForm } from './BrandingForm';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Branding — PMBC Admin',
  robots: { index: false, follow: false },
};

export default async function BrandingAdminPage() {
  const branding = await fetchBranding();

  return (
    <div className="mx-auto max-w-5xl">
      <AdminPageHeader
        eyebrow="Admin"
        title="Branding"
        description="Logos, brand identity, and color tokens. Used everywhere on the public site and in transactional emails."
      />
      {branding ? (
        <BrandingForm initial={branding} />
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          branding_config row missing. Run migrations 003 and re-seed.
        </div>
      )}
    </div>
  );
}
