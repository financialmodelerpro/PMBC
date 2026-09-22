import { ADMIN_COLORS, adminBadge, adminCard, adminTable, adminTd, adminTh, adminThead } from '@/lib/admin/styles';
import { growthDataLayerStatus, migrationsFor } from '@/lib/growth/db';

/**
 * Whether the Growth data layer (migrations 083 onwards) is in place, table by table.
 * Row counts include test rows. Reads counts only, never records.
 */
export async function DataLayerStatus() {
  const status = await growthDataLayerStatus();
  const errors = status.tables.filter((t) => t.state === 'error');
  return (
    <section style={{ ...adminCard, marginBottom: 20 }} aria-labelledby="growth-data-layer">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h2 id="growth-data-layer" style={{ margin: 0, fontSize: 15, fontWeight: 700, color: ADMIN_COLORS.textHeading }}>
          Data layer
        </h2>
        <span style={adminBadge(status.ready ? 'success' : errors.length ? 'danger' : 'warning')}>
          {status.ready ? 'Ready' : errors.length ? 'Cannot be read' : 'Not ready'}
        </span>
      </div>
      <p style={{ margin: '8px 0 16px', fontSize: 13, color: ADMIN_COLORS.textBody }}>
        {status.ready
          ? `All ${status.tables.length} Growth tables are in place.`
          : status.missing.length
            ? `Missing: ${status.missing.join(', ')}. Apply ${migrationsFor(status.missing).join(' then ')} in the Supabase SQL editor.`
            : 'The tables could not be read. See the detail below.'}
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table style={adminTable}>
          <thead style={adminThead}>
            <tr>
              <th style={adminTh}>Table</th>
              <th style={adminTh}>State</th>
              <th style={{ ...adminTh, textAlign: 'right' }}>Rows</th>
            </tr>
          </thead>
          <tbody>
            {status.tables.map((t) => (
              <tr key={t.table}>
                <td style={{ ...adminTd, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12 }}>{t.table}</td>
                <td style={adminTd}>
                  <span style={adminBadge(t.state === 'ready' ? 'success' : t.state === 'missing' ? 'warning' : 'danger')}>
                    {t.state === 'ready' ? 'Ready' : t.state === 'missing' ? 'Missing' : 'Error'}
                  </span>
                  {t.detail && <div style={{ marginTop: 4, fontSize: 12, color: ADMIN_COLORS.danger }}>{t.detail}</div>}
                </td>
                <td style={{ ...adminTd, textAlign: 'right', fontSize: 13 }}>{t.rows ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
