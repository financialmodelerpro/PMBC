import { Hourglass } from 'lucide-react';

import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { ADMIN_COLORS, adminCard } from '@/lib/admin/styles';
import { requireGrowthSession } from '@/lib/growth/access';
import { growthPage, type GrowthPageKey } from '@/lib/growth/pages';

/**
 * A Growth page that has not been built yet: its title, its purpose, and which
 * build phase delivers it. No data is read and nothing is invented.
 *
 * Checks the session itself before rendering (see `requireGrowthSession`).
 */
export async function GrowthPlaceholder({ pageKey }: { pageKey: GrowthPageKey }) {
  await requireGrowthSession();
  const page = growthPage(pageKey);
  return (
    <>
      <AdminPageHeader eyebrow="Growth Engine" title={page.title} description={page.purpose} />
      <div style={{ ...adminCard, textAlign: 'center', padding: '48px 24px', color: ADMIN_COLORS.textMuted }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <Hourglass size={28} color={ADMIN_COLORS.textMicro} aria-hidden />
        </div>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: ADMIN_COLORS.textHeading }}>Not built yet</p>
        <p style={{ margin: '6px auto 0', fontSize: 13, maxWidth: 420 }}>{page.phase}</p>
      </div>
    </>
  );
}
