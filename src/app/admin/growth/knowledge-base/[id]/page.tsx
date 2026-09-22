import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { KbEditor } from '@/components/admin/growth/kb/KbEditor';
import { ADMIN_COLORS, adminBadge, adminCard } from '@/lib/admin/styles';
import { requireGrowthSession } from '@/lib/growth/access';
import { getKbItem, hasUnapprovedEdits, kbItemActivity, listCaseStudyOptions } from '@/lib/growth/kb';
import { SITE_SERVICE_OPTIONS, kbKind } from '@/lib/growth/kbModel';

export const metadata: Metadata = { title: 'Edit item | Knowledge Base | PMBC Admin', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function when(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default async function KbItemPage(props: { params: Promise<{ id: string }> }) {
  await requireGrowthSession();
  const { id } = await props.params;
  if (!UUID.test(id)) notFound();
  const item = await getKbItem(id).catch(() => null);
  if (!item) notFound();
  const cfg = kbKind(item.kind);
  const [caseStudies, history] = await Promise.all([cfg.link === 'case_study' ? listCaseStudyOptions() : Promise.resolve([]), kbItemActivity(id)]);
  const edits = item.status === 'approved' && hasUnapprovedEdits(item);
  const approved = item.approved_content;

  return (
    <>
      <Link href={`/admin/growth/knowledge-base?kind=${item.kind}`} style={{ fontSize: 13, color: ADMIN_COLORS.primary, textDecoration: 'none' }}>
        Back to {cfg.label}
      </Link>
      <div style={{ height: 12 }} />
      <AdminPageHeader
        eyebrow={`Knowledge Base, ${cfg.singular.toLowerCase()}`}
        title={item.title}
        description={
          item.status === 'approved'
            ? edits
              ? 'Approved, with unapproved edits. AI agents read the approved copy below until you approve again.'
              : 'Approved. AI agents read this item.'
            : item.status === 'archived'
              ? 'Archived. AI agents do not read it.'
              : 'Draft. AI agents do not read it until it is approved.'
        }
        actions={item.is_test ? <span style={adminBadge('warning')}>Test</span> : undefined}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: 20, alignItems: 'start' }}>
        <KbEditor
          item={{ id: item.id, kind: item.kind, title: item.title, content: item.content, site_service_slug: item.site_service_slug, case_study_id: item.case_study_id, related_service_slugs: item.related_service_slugs, status: item.status }}
          caseStudies={caseStudies}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
          <section style={adminCard} aria-labelledby="kb-approved">
            <h2 id="kb-approved" style={{ margin: 0, fontSize: 14, fontWeight: 700, color: ADMIN_COLORS.textHeading }}>
              Approved copy
            </h2>
            {!approved || !item.approved_at ? (
              <p style={{ margin: '8px 0 0', fontSize: 13, color: ADMIN_COLORS.textMuted }}>Never approved.</p>
            ) : (
              <>
                <p style={{ margin: '6px 0 12px', fontSize: 12, color: ADMIN_COLORS.textMuted }}>
                  Approved by {item.approved_by_name ?? 'unknown'} on {when(item.approved_at)}
                  {item.status !== 'approved' ? '. Not read by agents while the item is not approved.' : '.'}
                </p>
                <p style={{ margin: 0, fontWeight: 600, fontSize: 13 }}>{item.approved_title}</p>
                {typeof approved.site_service_slug === 'string' && (
                  <p style={{ margin: '6px 0 0', fontSize: 12, color: ADMIN_COLORS.textBody }}>
                    Site page: /services/{approved.site_service_slug}
                  </p>
                )}
                {Array.isArray(approved.related_service_slugs) && approved.related_service_slugs.length > 0 && (
                  <p style={{ margin: '6px 0 0', fontSize: 12, color: ADMIN_COLORS.textBody }}>
                    Related services: {approved.related_service_slugs.map((slug) => SITE_SERVICE_OPTIONS.find((s) => s.slug === slug)?.title ?? slug).join(', ')}
                  </p>
                )}
                {typeof approved.case_study_id === 'string' && (
                  <p style={{ margin: '6px 0 0', fontSize: 12, color: ADMIN_COLORS.textBody }}>
                    Case study: {caseStudies.find((c) => c.id === approved.case_study_id)?.title ?? approved.case_study_id}
                  </p>
                )}
                <dl style={{ margin: '10px 0 0', fontSize: 13 }}>
                  {cfg.fields.map((f) => {
                    const v = approved[f.key];
                    if (!v || (Array.isArray(v) && !v.length)) return null;
                    return (
                      <div key={f.key} style={{ marginTop: 10 }}>
                        <dt style={{ fontSize: 11, fontWeight: 700, color: ADMIN_COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{f.label}</dt>
                        <dd style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap', color: ADMIN_COLORS.textBody }}>
                          {Array.isArray(v) ? (
                            <ul style={{ margin: 0, paddingLeft: 18 }}>
                              {v.map((x, n) => (
                                <li key={n}>{x}</li>
                              ))}
                            </ul>
                          ) : (
                            v
                          )}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              </>
            )}
          </section>

          <section style={adminCard} aria-labelledby="kb-history">
            <h2 id="kb-history" style={{ margin: 0, fontSize: 14, fontWeight: 700, color: ADMIN_COLORS.textHeading }}>
              History
            </h2>
            {history.length === 0 ? (
              <p style={{ margin: '8px 0 0', fontSize: 13, color: ADMIN_COLORS.textMuted }}>Nothing logged yet.</p>
            ) : (
              <ol style={{ listStyle: 'none', margin: '10px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {history.map((h) => (
                  <li key={h.id} style={{ fontSize: 13, borderLeft: `2px solid ${ADMIN_COLORS.borderSoft}`, paddingLeft: 10 }}>
                    <div style={{ color: ADMIN_COLORS.textHeading }}>{h.summary ?? h.action}</div>
                    <div style={{ fontSize: 12, color: ADMIN_COLORS.textMuted }}>
                      {when(h.created_at)}, {typeof h.metadata?.actor_name === 'string' ? h.metadata.actor_name : h.actor_type === 'system' ? 'system' : 'unknown'}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
