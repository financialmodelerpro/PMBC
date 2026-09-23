import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { CloseConversation } from '@/components/admin/growth/conversations/ConversationActions';
import { ADMIN_COLORS, adminBadge, adminCard } from '@/lib/admin/styles';
import { requireGrowthSession } from '@/lib/growth/access';
import { getConversation } from '@/lib/growth/chat';
import { QUALIFICATION_FIELDS } from '@/lib/growth/chatModel';
import { dateTime, sar, serviceLabel } from '@/lib/growth/format';

export const metadata: Metadata = { title: 'Conversation | Growth | PMBC Admin', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const h2 = { margin: '0 0 10px', fontSize: 15, fontWeight: 700, color: ADMIN_COLORS.textHeading } as const;

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  await requireGrowthSession();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const r = await getConversation(id);
  if (!r) notFound();
  const { c, messages } = r;
  const q = c.qualification as Record<string, unknown>;

  return (
    <>
      <AdminPageHeader eyebrow="Growth Engine: Conversation" title={c.consent_given ? c.visitor_name ?? 'Visitor' : 'Anonymous visitor'} description={`Started ${dateTime(c.created_at)} on ${c.first_page ?? ''}`} actions={<Link href="/admin/growth/conversations">All conversations</Link>} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 16, marginBottom: 16 }}>
        <section style={adminCard}>
          <h2 style={h2}>Qualification</h2>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            <span style={adminBadge(c.route === 'hot' || c.route === 'escalated' ? 'danger' : c.route === 'warm' ? 'warning' : 'neutral')}>Route: {c.route}</span>
            {c.temperature && <span style={adminBadge('neutral')}>{c.temperature}, score {c.score}</span>}
            <span style={adminBadge('neutral')}>{c.status}</span>
            {c.is_mock && <span style={adminBadge('warning')}>Mock</span>}
            {c.is_test && <span style={adminBadge('neutral')}>Test</span>}
          </div>
          <dl style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '6px 14px', margin: 0, fontSize: 13 }}>
            {QUALIFICATION_FIELDS.map((f) => (
              <div key={f.key} style={{ display: 'contents' }}>
                <dt style={{ color: ADMIN_COLORS.textMuted }}>{f.label}</dt>
                <dd style={{ margin: 0 }}>{q[f.key] === null || q[f.key] === undefined ? '' : f.key === 'size_sar' ? sar(q[f.key] as number) : f.key === 'service' ? serviceLabel(String(q[f.key])) : String(q[f.key])}</dd>
              </div>
            ))}
          </dl>
          {c.escalation_reason && <p style={{ margin: '10px 0 0', fontSize: 13, color: ADMIN_COLORS.danger }}>Escalated: {c.escalation_reason}</p>}
          {c.alert_sent_at && <p style={{ margin: '6px 0 0', fontSize: 12, color: ADMIN_COLORS.textMuted }}>You were alerted {dateTime(c.alert_sent_at)}.</p>}
        </section>
        <section style={adminCard}>
          <h2 style={h2}>Visitor and consent</h2>
          {c.consent_given ? (
            <>
              <p style={{ margin: '0 0 6px', fontSize: 13 }}>
                {c.visitor_name}, {c.visitor_email}
                {c.visitor_phone ? `, ${c.visitor_phone}` : ''}
                {c.visitor_company ? `, ${c.visitor_company}` : ''}
              </p>
              <p style={{ margin: '0 0 6px', fontSize: 12, color: ADMIN_COLORS.textMuted }}>
                Consented {dateTime(c.consent_at)} to: &ldquo;{c.consent_text}&rdquo;
              </p>
              {c.nurture_opt_in && <p style={{ margin: 0, fontSize: 12 }}>Opted in to occasional insights {dateTime(c.nurture_opt_in_at)}.</p>}
            </>
          ) : (
            <p style={{ margin: 0, fontSize: 13, color: ADMIN_COLORS.textMuted }}>No consent given: no contact details are stored, and any typed into the chat were removed.</p>
          )}
          <div style={{ display: 'flex', gap: 12, marginTop: 10, fontSize: 13 }}>
            {c.lead_id && <Link href={`/admin/growth/pipeline/${c.lead_id}`}>Lead</Link>}
            {c.company_id && <Link href={`/admin/growth/prospects/${c.company_id}`}>Company</Link>}
            {c.tracked_link_id && <span>Arrived from an outreach email</span>}
          </div>
          {c.status !== 'closed' && (
            <div style={{ marginTop: 12 }}>
              <CloseConversation id={c.id} />
            </div>
          )}
        </section>
      </div>
      <section style={adminCard}>
        <h2 style={h2}>Transcript</h2>
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {messages.map((m) => (
            <li key={m.id} style={{ fontSize: 13, background: m.role === 'visitor' ? ADMIN_COLORS.altBg : m.role === 'system' ? ADMIN_COLORS.warningBg : '#fff', border: `1px solid ${ADMIN_COLORS.borderSoft}`, borderRadius: 8, padding: '8px 12px' }}>
              <div style={{ fontSize: 11, color: ADMIN_COLORS.textMuted, marginBottom: 4 }}>
                {m.role} {dateTime(m.created_at)} {m.is_mock ? '(mock)' : ''} {m.flag ? `flag: ${m.flag}` : ''}
              </div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
