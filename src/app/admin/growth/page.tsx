import type { Metadata } from 'next';

import { DataLayerStatus } from '@/components/admin/growth/DataLayerStatus';
import { GrowthPlaceholder } from '@/components/admin/growth/GrowthPlaceholder';

export const metadata: Metadata = { title: 'Growth | PMBC Admin', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default function GrowthHomePage() {
  return (
    <GrowthPlaceholder pageKey="home">
      <DataLayerStatus />
    </GrowthPlaceholder>
  );
}
