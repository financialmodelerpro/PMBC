import type { Metadata } from 'next';
import Link from 'next/link';

import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { ChatPreview } from '@/components/admin/growth/conversations/ChatPreview';
import { PreviewPagePicker } from '@/components/admin/growth/conversations/ConversationActions';
import { MigrationNotice } from '@/components/admin/tools/MigrationNotice';
import { ADMIN_COLORS, adminBadge, adminCard, adminTable, adminTd, adminTh, adminThead } from '@/lib/admin/styles';
import { requireGrowthSession } from '@/lib/growth/access';
import { isMockMode } from '@/lib/growth/ai/provider';
import { listConversations } from '@/lib/growth/chat';
import { tableExists } from '@/lib/growth/db';
import { getEngineSettings } from '@/lib/growth/engineSettings';
import { dateTime, temperatureTone } from '@/lib/growth/format';
import { growthPage } from '@/lib/growth/pages';

export const metadata: Metadata = { title: 'Conversations | Growth | PMBC Admin', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const ROUTE_TONE = { hot: 'danger', warm: 'warning', cold: 'neutral', escalated: 'danger', none: 'neutral' } as const;

export default async function GrowthConversationsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireGrowthSession();
  const page = growthPage('conversations');
  const sp = await searchParams;
  const route = typeof sp.route === 'string' && ['hot', 'warm', 'cold', 'escalated', 'none'].includes(sp.route) ? sp.route : '';
  const includeTest = sp.test === '1';
  const previewPage = typeof sp.page === 'string' && /^\/[^\s]{0,200}$/.test(sp.page) ? sp.page : '/services/refm';
  const ready = await tableExists('growth_conversations');
  const [engine, rows] = await Promise.all([getEngineSettings(), ready ? listConversations({ includeTest, route: route || undefined }) : Promise.resolve([])]);
  const on = !engine.missing.includes('chat_widget_enabled') && engine.values.chat_widget_enabled;
  const mock = isMockMode();

  return (
    <>
      <AdminPageHeader
        eyebrow="Growth Engine"
        title={page.title}
        description={page.purpose}
        actions={<Link href="/admin/growth/conversations/valuation">Valuation tool leads</Link>}
      />
      {!ready && <MigrationNotice migration="090_growth_website_chat.sql" table="growth_conversations" effect="The website chat cannot be switched on or previewed until then. The public site is unaffected." />}
      <section style={{ ...adminCard, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
          <span style={adminBadge(on && !mock ? 'success' : 'neutral')}>{on ? (mock ? 'Switched on, but hidden: no Anthropic key' : 'Live on the website') : 'Off: nothing is added to the website'}</span>
          {mock && <span style={adminBadge('warning')}>Mock mode</span>}
          <Link href="/admin/growth/settings/engine#chat-settings" style={{ fontSize: 13 }}>
            Chat settings
          </Link>
        </div>
        <p style={{ margin: 0, fontSize: 12, color: ADMIN_COLORS.textMuted }}>
          The widget appears on the public site only when it is switched on in Settings and the Anthropic key is set; visitors never see mock replies. It answers only from the approved Knowledge Base, never quotes prices, guarantees or client names, sends pricing, legal, complaints and sensitive matters to you, stores contact details only with consent, and alerts you to Hot leads.
        </p>
      </section>

      {ready && (
        <section style={{ ...adminCard, marginBottom: 16 }} aria-labelledby="preview">
          <h2 id="preview" style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 700, color: ADMIN_COLORS.textHeading }}>
            Try it
          </h2>
          <PreviewPagePicker value={previewPage} />
          <ChatPreview page={previewPage} />
        </section>
      )}

      {ready && (
        <section style={{ ...adminCard, padding: 0 }}>
          <div style={{ padding: '14px 20px', display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 13 }}>
            {['', 'hot', 'warm', 'cold', 'escalated', 'none'].map((r) => (
              <Link key={r || 'all'} href={`/admin/growth/conversations?${new URLSearchParams({ ...(r ? { route: r } : {}), ...(includeTest ? { test: '1' } : {}) })}`} style={{ fontWeight: route === r ? 700 : 400 }}>
                {r ? r[0].toUpperCase() + r.slice(1) : 'All'}
              </Link>
            ))}
            <Link href={`/admin/growth/conversations?${new URLSearchParams({ ...(route ? { route } : {}), ...(includeTest ? {} : { test: '1' }) })}`}>{includeTest ? 'Hide test' : 'Include test'}</Link>
          </div>
          {rows.length === 0 ? (
            <p style={{ padding: '0 20px 20px', margin: 0, fontSize: 13, color: ADMIN_COLORS.textMuted }}>No conversations yet.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={adminTable}>
                <thead style={adminThead}>
                  <tr>
                    <th style={adminTh}>Started</th>
                    <th style={adminTh}>Visitor</th>
                    <th style={adminTh}>Route</th>
                    <th style={adminTh}>Page</th>
                    <th style={{ ...adminTh, textAlign: 'right' }}>Messages</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <tr key={c.id}>
                      <td style={{ ...adminTd, fontSize: 12, whiteSpace: 'nowrap' }}>
                        <Link href={`/admin/growth/conversations/${c.id}`}>{dateTime(c.created_at)}</Link>
                      </td>
                      <td style={{ ...adminTd, fontSize: 13 }}>
                        {c.consent_given ? `${c.visitor_name ?? ''}${c.visitor_company ? `, ${c.visitor_company}` : ''}` : 'Anonymous'}
                        {c.tracked_link_id && <span style={{ ...adminBadge('neutral'), marginLeft: 6 }}>From outreach</span>}
                        {c.is_mock && <span style={{ ...adminBadge('warning'), marginLeft: 6 }}>Mock</span>}
                        {c.is_test && <span style={{ ...adminBadge('neutral'), marginLeft: 6 }}>Test</span>}
                      </td>
                      <td style={adminTd}>
                        <span style={adminBadge(ROUTE_TONE[c.route])}>{c.route}</span>
                        {c.temperature && <span style={{ ...adminBadge(temperatureTone(c.temperature)), marginLeft: 4 }}>{c.score}</span>}
                      </td>
                      <td style={{ ...adminTd, fontSize: 12 }}>{c.first_page}</td>
                      <td style={{ ...adminTd, textAlign: 'right' }}>{c.message_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </>
  );
}
