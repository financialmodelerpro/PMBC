import type { Metadata } from 'next';
import Link from 'next/link';

import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { SettingsTabs } from '@/components/admin/growth/settings/SettingsTabs';
import { ADMIN_COLORS, adminBadge, adminButtonGhost, adminButtonPrimary, adminCard, adminInput, adminLabel, adminTable, adminTd, adminTh, adminThead } from '@/lib/admin/styles';
import { requireGrowthSession } from '@/lib/growth/access';
import { AUDIT_ACTORS, AUDIT_PAGE_SIZE, AUDIT_TYPES, listAudit, parseAuditFilters, relatedOptions } from '@/lib/growth/audit';

export const metadata: Metadata = { title: 'Audit log | Growth | PMBC Admin', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });

function actorLabel(type: string, id: string | null, meta: Record<string, unknown>): string {
  const name = typeof meta?.actor_name === 'string' ? meta.actor_name : null;
  if (type === 'admin') return name ?? 'Admin';
  if (type === 'ai') return `AI agent${id ? `: ${id}` : ''}`;
  return id ? `System: ${id}` : 'System';
}

/** Old and new values of a settings change, one line per field. */
function changes(meta: Record<string, unknown>): string[] {
  const c = meta?.changes;
  if (!c || typeof c !== 'object') return [];
  const show = (v: unknown) => (v === null ? 'not set' : Array.isArray(v) ? v.join(', ') : String(v));
  return Object.entries(c as Record<string, { old: unknown; new: unknown }>).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${show(v.old)} to ${show(v.new)}`);
}

export default async function GrowthAuditPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireGrowthSession();
  const search = await props.searchParams;
  const f = parseAuditFilters(search);
  const [{ rows, total, error }, related] = await Promise.all([listAudit(f), relatedOptions(f.includeTest).catch(() => ({ companies: [], leads: [], kb: [] }))]);
  const pages = Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE));
  const href = (page: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(search)) if (typeof v === 'string' && v && k !== 'page') q.set(k, v);
    q.set('page', String(page));
    return `/admin/growth/settings/audit?${q.toString()}`;
  };

  return (
    <>
      <AdminPageHeader eyebrow="Growth Engine" title="Audit log" description="Everything that happens in the Growth Engine, newest first: settings, suppression, the Knowledge Base, and later every AI action." />
      <SettingsTabs active="audit" />

      <form method="get" style={{ ...adminCard, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))', gap: 12, alignItems: 'end', marginBottom: 16 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={adminLabel}>Type</span>
          <select name="type" defaultValue={f.type} style={adminInput}>
            <option value="">All types</option>
            {AUDIT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={adminLabel}>Actor</span>
          <select name="actor" defaultValue={f.actor} style={adminInput}>
            <option value="">Anyone</option>
            {AUDIT_ACTORS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={adminLabel}>From</span>
          <input type="date" name="from" defaultValue={f.from} style={adminInput} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={adminLabel}>To</span>
          <input type="date" name="to" defaultValue={f.to} style={adminInput} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={adminLabel}>Related to</span>
          <select name="related" defaultValue={f.related} style={adminInput}>
            <option value="">Anything</option>
            {[
              { label: 'Companies', list: related.companies },
              { label: 'Leads', list: related.leads },
              { label: 'Knowledge Base', list: related.kb },
            ]
              .filter((g) => g.list.length)
              .map((g) => (
                <optgroup key={g.label} label={g.label}>
                  {g.list.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </optgroup>
              ))}
          </select>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, paddingBottom: 8 }}>
          <input type="checkbox" name="test" value="1" defaultChecked={f.includeTest} />
          Show test rows
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" style={adminButtonPrimary}>
            Filter
          </button>
          <Link href="/admin/growth/settings/audit" style={{ ...adminButtonGhost, padding: '9px 14px' }}>
            Clear
          </Link>
        </div>
      </form>

      {error && <p style={{ color: ADMIN_COLORS.danger, fontSize: 13 }}>Could not load the log: {error}</p>}
      <div style={{ ...adminCard, padding: 0, overflowX: 'auto' }}>
        <table style={adminTable}>
          <thead style={adminThead}>
            <tr>
              <th style={adminTh}>When</th>
              <th style={adminTh}>What</th>
              <th style={adminTh}>Who</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} style={{ ...adminTd, color: ADMIN_COLORS.textMuted, textAlign: 'center', padding: 28 }}>
                  Nothing matches these filters.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td style={{ ...adminTd, fontSize: 12, whiteSpace: 'nowrap', verticalAlign: 'top' }}>{when(r.created_at)}</td>
                <td style={{ ...adminTd, fontSize: 13, minWidth: 220 }}>
                  <div style={{ color: ADMIN_COLORS.textHeading }}>
                    {r.summary ?? r.action}
                    {r.is_test && <span style={{ ...adminBadge('warning'), marginLeft: 6 }}>Test</span>}
                  </div>
                  <div style={{ fontSize: 11, color: ADMIN_COLORS.textMuted, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{r.action}</div>
                  {changes(r.metadata).map((line) => (
                    <div key={line} style={{ fontSize: 12, color: ADMIN_COLORS.textBody, marginTop: 2 }}>
                      {line}
                    </div>
                  ))}
                </td>
                <td style={{ ...adminTd, fontSize: 12, verticalAlign: 'top' }}>{actorLabel(r.actor_type, r.actor_id, r.metadata)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 12, fontSize: 13, color: ADMIN_COLORS.textMuted }}>
        <span>
          {total} {total === 1 ? 'entry' : 'entries'}
          {f.includeTest ? ', including test rows' : ''}
        </span>
        {pages > 1 && (
          <span style={{ display: 'flex', gap: 10 }}>
            {f.page > 1 && <Link href={href(f.page - 1)}>Newer</Link>}
            <span>
              Page {f.page} of {pages}
            </span>
            {f.page < pages && <Link href={href(f.page + 1)}>Older</Link>}
          </span>
        )}
      </div>
    </>
  );
}
