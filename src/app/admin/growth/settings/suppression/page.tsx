import type { Metadata } from 'next';
import Link from 'next/link';

import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { SettingsTabs } from '@/components/admin/growth/settings/SettingsTabs';
import { SuppressionManager } from '@/components/admin/growth/settings/SuppressionManager';
import { MigrationNotice } from '@/components/admin/tools/MigrationNotice';
import { ADMIN_COLORS } from '@/lib/admin/styles';
import { requireGrowthSession } from '@/lib/growth/access';
import { listSuppressions } from '@/lib/growth/suppression';

export const metadata: Metadata = { title: 'Suppression list | Growth | PMBC Admin', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const SOURCES: Record<string, string> = { manual: 'Added by hand', valuation_unsubscribe: 'Valuation tool unsubscribe', growth_contact: 'Growth contact opt-out' };
const sourceLabel = (s: string) => SOURCES[s] ?? s;

const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default async function SuppressionPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireGrowthSession();
  const includeTest = (await props.searchParams).test === '1';
  const { rows, missingTable, error } = await listSuppressions({ includeRemoved: true, includeTest });
  return (
    <>
      <AdminPageHeader
        eyebrow="Growth Engine"
        title="Suppression list"
        description="Emails and domains that must never be contacted. Suppression always wins: every send checks this list, the valuation tool's unsubscribes and opted-out contacts first."
      />
      <SettingsTabs active="suppression" />
      {missingTable && <MigrationNotice migration="085_growth_settings.sql" table="growth_suppressions" effect="Until then every email is treated as suppressed." />}
      {error && <p style={{ color: ADMIN_COLORS.danger, fontSize: 13 }}>Could not load the list: {error}</p>}
      {!missingTable && !error && (
        <>
          <p style={{ margin: '0 0 12px', fontSize: 12 }}>
            <Link href={includeTest ? '/admin/growth/settings/suppression' : '/admin/growth/settings/suppression?test=1'} style={{ color: ADMIN_COLORS.primary }}>
              {includeTest ? 'Hide test entries' : 'Show test entries'}
            </Link>
          </p>
          <SuppressionManager
            rows={rows.map((r) => ({
              id: r.id,
              kind: r.kind,
              value: r.value,
              reason: r.reason,
              sourceLabel: `${sourceLabel(r.source)}${r.added_by_name ? `, ${r.added_by_name}` : ''}`,
              addedLabel: when(r.created_at),
              removedLabel: r.removed_at ? `${when(r.removed_at)}${r.removed_by_name ? ` by ${r.removed_by_name}` : ''}` : null,
              removedReason: r.removed_reason,
              isTest: r.is_test,
            }))}
          />
        </>
      )}
    </>
  );
}
