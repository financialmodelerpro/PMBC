import type { Metadata } from 'next';
import Link from 'next/link';

import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { KbActions } from '@/components/admin/growth/kb/KbActions';
import { MigrationNotice } from '@/components/admin/tools/MigrationNotice';
import {
  ADMIN_COLORS,
  adminBadge,
  adminButtonGhost,
  adminButtonPrimary,
  adminCard,
  adminInput,
  adminLabel,
  adminTable,
  adminTd,
  adminTh,
  adminThead,
} from '@/lib/admin/styles';
import { requireGrowthSession } from '@/lib/growth/access';
import { hasUnapprovedEdits, kbReadiness, listKbItems, type KbItem } from '@/lib/growth/kb';
import { KB_KINDS, KB_STATUSES, approvalProblems, isKbKind, type KbStatus } from '@/lib/growth/kbModel';
import { growthPage } from '@/lib/growth/pages';

export const metadata: Metadata = { title: 'Knowledge Base | Growth | PMBC Admin', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const STATUS_TONE: Record<KbStatus, 'neutral' | 'success' | 'warning'> = { draft: 'neutral', approved: 'success', archived: 'warning' };
const STATUS_LABEL: Record<KbStatus, string> = { draft: 'Draft', approved: 'Approved', archived: 'Archived' };

function when(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default async function GrowthKnowledgeBasePage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireGrowthSession();
  const page = growthPage('knowledge-base');
  const search = await props.searchParams;
  const kind = typeof search.kind === 'string' && isKbKind(search.kind) ? search.kind : null;
  const status = typeof search.status === 'string' && (KB_STATUSES as readonly string[]).includes(search.status) ? (search.status as KbStatus) : null;

  const { items, missingTable, error } = await listKbItems();
  const readiness = kbReadiness(items);
  const shown = items.filter((i) => (!kind || i.kind === kind) && (!status || i.status === status));
  const kinds = KB_KINDS.filter((k) => !kind || k.kind === kind);

  return (
    <>
      <AdminPageHeader eyebrow="Growth Engine" title={page.title} description={`${page.purpose} AI agents read approved items only, and only their approved copy.`} />
      {missingTable && (
        <MigrationNotice migration="084_growth_knowledge_base.sql" table="growth_kb_items" effect="Until then there is nothing to edit, and AI agents receive no knowledge." />
      )}
      {error && <p style={{ color: ADMIN_COLORS.danger, fontSize: 13 }}>Could not load the Knowledge Base: {error}</p>}

      {!missingTable && !error && (
        <>
          <section aria-label="Readiness" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10, marginBottom: 20 }}>
            {readiness.map((r) => (
              <Link
                key={r.kind}
                href={`/admin/growth/knowledge-base?kind=${r.kind}`}
                style={{ ...adminCard, padding: '12px 14px', textDecoration: 'none', borderColor: kind === r.kind ? ADMIN_COLORS.primary : ADMIN_COLORS.border }}
              >
                <div style={{ fontSize: 12, fontWeight: 600, color: ADMIN_COLORS.textMuted }}>{r.label}</div>
                <div style={{ marginTop: 4, fontSize: 14, fontWeight: 700, color: r.total > 0 && r.approved === r.total ? ADMIN_COLORS.success : ADMIN_COLORS.textHeading }}>
                  {r.approved} of {r.total} approved
                </div>
              </Link>
            ))}
          </section>

          <form method="get" style={{ ...adminCard, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', marginBottom: 20 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 180px' }}>
              <span style={adminLabel}>Type</span>
              <select name="kind" defaultValue={kind ?? ''} style={adminInput}>
                <option value="">All types</option>
                {KB_KINDS.map((k) => (
                  <option key={k.kind} value={k.kind}>
                    {k.label}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 140px' }}>
              <span style={adminLabel}>Status</span>
              <select name="status" defaultValue={status ?? ''} style={adminInput}>
                <option value="">Any status</option>
                {KB_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" style={adminButtonPrimary}>
              Filter
            </button>
            <Link href="/admin/growth/knowledge-base" style={{ ...adminButtonGhost, padding: '9px 14px' }}>
              Clear
            </Link>
          </form>

          {kinds.map((k) => {
            const rows = shown.filter((i) => i.kind === k.kind);
            return (
              <section key={k.kind} style={{ ...adminCard, padding: 0, marginBottom: 20 }} aria-labelledby={`kb-${k.kind}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', padding: '16px 20px' }}>
                  <div style={{ minWidth: 0, flex: '1 1 260px' }}>
                    <h2 id={`kb-${k.kind}`} style={{ margin: 0, fontSize: 15, fontWeight: 700, color: ADMIN_COLORS.textHeading }}>
                      {k.label}
                    </h2>
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: ADMIN_COLORS.textMuted }}>{k.purpose}</p>
                  </div>
                  {!k.fixed && (
                    <Link href={`/admin/growth/knowledge-base/new?kind=${k.kind}`} style={{ ...adminButtonGhost, padding: '7px 12px', fontSize: 12 }}>
                      Add {k.singular.toLowerCase()}
                    </Link>
                  )}
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={adminTable}>
                    <thead style={adminThead}>
                      <tr>
                        <th style={adminTh}>{k.titleLabel}</th>
                        <th style={adminTh}>Status</th>
                        <th style={adminTh}>Last edited</th>
                        <th style={adminTh}>Approved by</th>
                        <th style={adminTh} />
                      </tr>
                    </thead>
                    <tbody>
                      {rows.length === 0 && (
                        <tr>
                          <td colSpan={5} style={{ ...adminTd, color: ADMIN_COLORS.textMuted, fontSize: 13 }}>
                            {status ? `No ${STATUS_LABEL[status].toLowerCase()} items.` : 'Nothing here yet.'}
                          </td>
                        </tr>
                      )}
                      {rows.map((i) => (
                        <Row key={i.id} item={i} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </>
      )}
    </>
  );
}

function Row({ item: i }: { item: KbItem }) {
  const edits = i.status === 'approved' && hasUnapprovedEdits(i);
  const problems = approvalProblems({ kind: i.kind, title: i.title, content: i.content, site_service_slug: i.site_service_slug, case_study_id: i.case_study_id });
  const actions = i.status === 'archived' ? (['restore'] as const) : i.status === 'approved' && !edits ? (['archive'] as const) : (['approve', 'archive'] as const);
  return (
    <tr>
      <td style={{ ...adminTd, minWidth: 180 }}>
        <Link href={`/admin/growth/knowledge-base/${i.id}`} style={{ fontWeight: 600, color: ADMIN_COLORS.primary, textDecoration: 'none' }}>
          {i.title}
        </Link>
      </td>
      <td style={{ ...adminTd, whiteSpace: 'nowrap' }}>
        <span style={adminBadge(STATUS_TONE[i.status])}>{STATUS_LABEL[i.status]}</span>
        {edits && <span style={{ ...adminBadge('warning'), marginLeft: 4 }}>Unapproved edits</span>}
      </td>
      <td style={{ ...adminTd, fontSize: 12, whiteSpace: 'nowrap' }}>
        {when(i.updated_at)}
        {i.updated_by_name && <div style={{ color: ADMIN_COLORS.textMuted }}>{i.updated_by_name}</div>}
      </td>
      <td style={{ ...adminTd, fontSize: 12, whiteSpace: 'nowrap' }}>
        {i.approved_at ? (
          <>
            {i.approved_by_name ?? 'Unknown'}
            <div style={{ color: ADMIN_COLORS.textMuted }}>{when(i.approved_at)}</div>
          </>
        ) : (
          <span style={{ color: ADMIN_COLORS.textMuted }}>Never</span>
        )}
      </td>
      <td style={{ ...adminTd, textAlign: 'right' }}>
        <KbActions id={i.id} actions={[...actions]} compact disabledReason={problems.length ? `Not ready: ${problems.join('; ')}` : null} />
      </td>
    </tr>
  );
}
