import type { Metadata } from 'next';

import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { SettingsForm } from '@/components/admin/growth/settings/SettingsForm';
import { SettingsTabs } from '@/components/admin/growth/settings/SettingsTabs';
import { MigrationNotice } from '@/components/admin/tools/MigrationNotice';
import { ADMIN_COLORS, adminBadge, adminCard, adminTable, adminTd, adminTh, adminThead } from '@/lib/admin/styles';
import { requireGrowthSession } from '@/lib/growth/access';
import { integrationStatus } from '@/lib/growth/integrations';
import { growthPage } from '@/lib/growth/pages';
import { retentionPreview } from '@/lib/growth/retention';
import { getGrowthSettings } from '@/lib/growth/settings';

export const metadata: Metadata = { title: 'Settings | Growth | PMBC Admin', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

export default async function GrowthSettingsPage() {
  await requireGrowthSession();
  const page = growthPage('settings');
  const read = await getGrowthSettings();
  const ready = read.source === 'database';
  const preview = ready ? await retentionPreview(read.settings.retention_months) : null;
  const integrations = integrationStatus();

  return (
    <>
      <AdminPageHeader eyebrow="Growth Engine" title={page.title} description={page.purpose} />
      <SettingsTabs active="settings" />
      {read.source === 'missing' && (
        <MigrationNotice migration="085_growth_settings.sql" table="growth_settings" effect="Until then the defaults below are shown but cannot be saved, and nothing may be sent." />
      )}
      {read.source === 'error' && <p style={{ color: ADMIN_COLORS.danger, fontSize: 13 }}>Could not read the settings: {read.error}</p>}
      {ready && read.updatedAt && read.updatedBy && (
        <p style={{ margin: '0 0 14px', fontSize: 12, color: ADMIN_COLORS.textMuted }}>
          Last changed {day(read.updatedAt)} by {read.updatedBy}.
        </p>
      )}

      {ready ? <SettingsForm settings={read.settings} spentThisMonthUsd={0} /> : null}

      {preview && (
        <section style={{ ...adminCard, padding: 0, marginBottom: 16 }} aria-labelledby="retention-preview">
          <div style={{ padding: '16px 20px' }}>
            <h2 id="retention-preview" style={{ margin: 0, fontSize: 15, fontWeight: 700, color: ADMIN_COLORS.textHeading }}>
              Retention preview: {preview.rows.length} {preview.rows.length === 1 ? 'contact' : 'contacts'}
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: ADMIN_COLORS.textMuted }}>
              Contacts who never replied and were last contacted, or added, before {day(preview.cutoff)} ({read.settings.retention_months} months). Read only: nothing is deleted or anonymised.
            </p>
            {preview.error && <p style={{ margin: '8px 0 0', fontSize: 13, color: ADMIN_COLORS.danger }}>Could not build the preview: {preview.error}</p>}
          </div>
          {preview.rows.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={adminTable}>
                <thead style={adminThead}>
                  <tr>
                    <th style={adminTh}>Contact</th>
                    <th style={adminTh}>Company</th>
                    <th style={adminTh}>Last contact or added</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((r) => (
                    <tr key={r.id}>
                      <td style={{ ...adminTd, fontSize: 13 }}>
                        {r.full_name}
                        {r.email && <div style={{ fontSize: 12, color: ADMIN_COLORS.textMuted }}>{r.email}</div>}
                      </td>
                      <td style={{ ...adminTd, fontSize: 13 }}>{r.company ?? ''}</td>
                      <td style={{ ...adminTd, fontSize: 13, whiteSpace: 'nowrap' }}>{day(r.lastTouch)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <section style={{ ...adminCard, padding: 0 }} aria-labelledby="integrations">
        <div style={{ padding: '16px 20px' }}>
          <h2 id="integrations" style={{ margin: 0, fontSize: 15, fontWeight: 700, color: ADMIN_COLORS.textHeading }}>
            Integrations
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: ADMIN_COLORS.textMuted }}>Checked from the server environment. Values are never shown, only whether each is set.</p>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={adminTable}>
            <thead style={adminThead}>
              <tr>
                <th style={adminTh}>Integration</th>
                <th style={adminTh}>Status</th>
                <th style={adminTh}>Detail</th>
              </tr>
            </thead>
            <tbody>
              {integrations.map((i) => (
                <tr key={i.key}>
                  <td style={{ ...adminTd, fontSize: 13, minWidth: 180 }}>
                    <strong>{i.label}</strong>
                    <div style={{ fontSize: 12, color: ADMIN_COLORS.textMuted }}>{i.purpose}</div>
                  </td>
                  <td style={adminTd}>
                    <span style={adminBadge(i.state === 'configured' ? 'success' : 'neutral')}>{i.state === 'configured' ? 'Configured' : 'Not set up'}</span>
                  </td>
                  <td style={{ ...adminTd, fontSize: 12, color: ADMIN_COLORS.textBody }}>{i.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
