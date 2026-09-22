import type { Metadata } from 'next';

import { GrowthPlaceholder } from '@/components/admin/growth/GrowthPlaceholder';

export const metadata: Metadata = { title: 'Signals | Growth | PMBC Admin', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default function GrowthSignalsPage() {
  return <GrowthPlaceholder pageKey="signals" />;
}
