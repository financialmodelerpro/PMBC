import type { Metadata } from 'next';
import Link from 'next/link';

import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { ImportWizard } from '@/components/admin/growth/prospects/ImportWizard';
import { MigrationNotice } from '@/components/admin/tools/MigrationNotice';
import { ADMIN_COLORS, adminBadge, adminCard, adminTable, adminTd, adminTh, adminThead } from '@/lib/admin/styles';
import { requireGrowthSession } from '@/lib/growth/access';
import { tableExists } from '@/lib/growth/db';
import { dateTime } from '@/lib/growth/format';
import { recentImports } from '@/lib/growth/import';

export const metadata: Metadata = { title: 'Import | Growth | PMBC Admin', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function GrowthImportPage() {
  await requireGrowthSession();
  const canImport = await tableExists('growth_imports');
  const imports = canImport ? await recentImports() : [];
  return (
    <>
      <AdminPageHeader
        eyebrow="Growth Engine"
        title="Pilot CSV import"
        description="Companies, contacts, leads and past outreach from a spreadsheet. Everything imported is source Pilot. Suppressed emails are flagged and can never be contacted."
        actions={<Link href="/admin/growth/prospects">All prospects</Link>}
      />
      {!canImport && <MigrationNotice migration="088_growth_prospecting.sql" table="growth_imports" effect="Preview and dry run work now; the import itself waits for it." />}
      <ImportWizard canImport={canImport} />
      {imports.length > 0 && (
        <section style={{ ...adminCard, padding: 0, marginTop: 16 }}>
          <h2 style={{ margin: 0, padding: '16px 20px', fontSize: 15, fontWeight: 700, color: ADMIN_COLORS.textHeading }}>Past imports</h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={adminTable}>
              <thead style={adminThead}>
                <tr>
                  <th style={adminTh}>When</th>
                  <th style={adminTh}>File</th>
                  <th style={adminTh}>Created</th>
                  <th style={adminTh}>Skipped</th>
                </tr>
              </thead>
              <tbody>
                {imports.map((i) => (
                  <tr key={i.id}>
                    <td style={{ ...adminTd, fontSize: 12 }}>{dateTime(i.created_at)}</td>
                    <td style={{ ...adminTd, fontSize: 12 }}>
                      {i.filename ?? ''} {i.is_test && <span style={adminBadge('neutral')}>Test</span>}
                      <div style={{ color: ADMIN_COLORS.textMuted }}>{i.created_by_name}</div>
                    </td>
                    <td style={{ ...adminTd, fontSize: 12 }}>
                      {i.companies_created} companies, {i.contacts_created} contacts, {i.leads_created} leads, {i.activities_created} outreach records
                    </td>
                    <td style={{ ...adminTd, fontSize: 12 }}>
                      {i.skipped} rows, {i.suppressed} suppressed emails
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
