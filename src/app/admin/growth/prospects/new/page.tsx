import type { Metadata } from 'next';

import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { CompanyForm, emptyCompany } from '@/components/admin/growth/prospects/CompanyForm';
import { adminCard } from '@/lib/admin/styles';
import { requireGrowthSession } from '@/lib/growth/access';

export const metadata: Metadata = { title: 'New company | Growth | PMBC Admin', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function NewProspectPage() {
  await requireGrowthSession();
  return (
    <>
      <AdminPageHeader eyebrow="Growth Engine" title="New company" description="Add a prospect by hand. A website domain already on file is refused as a duplicate." />
      <section style={adminCard}>
        <CompanyForm initial={emptyCompany} />
      </section>
    </>
  );
}
