'use client';

import { useState } from 'react';

import { ADMIN_COLORS, adminBadge, adminCard } from '@/lib/admin/styles';
import { ACCEPTABLE_FIELDS, type AcceptableField, type BriefContent, type Sourced } from '@/lib/growth/agents/researchModel';
import { dateTime, sar, serviceLabel } from '@/lib/growth/format';

import { sendJson } from '../ui/client';
import { MockBadge, NoticeLine, PrimaryButton, useAction } from '../ui/kit';

type Brief = { id: string; created_at: string; is_mock: boolean; model: string; content: Record<string, unknown>; accepted: string[]; accepted_by_name: string | null; created_by_name: string | null; is_test: boolean };

function Sources({ urls }: { urls: string[] }) {
  return (
    <span style={{ fontSize: 11 }}>
      {urls.map((u, i) => (
        <a key={u} href={u} target="_blank" rel="noopener noreferrer nofollow" style={{ marginLeft: 4 }}>
          [{i + 1}]
        </a>
      ))}
    </span>
  );
}

function Fact({ label, f }: { label: string; f: Sourced }) {
  return (
    <p style={{ margin: '4px 0', fontSize: 13 }}>
      <strong>{label}:</strong> {f ? f.value : <em style={{ color: ADMIN_COLORS.textMuted }}>Unknown</em>}
      {f && <Sources urls={f.sources} />}
    </p>
  );
}

function BriefView({ brief }: { brief: Brief }) {
  const c = brief.content as unknown as BriefContent;
  const [picked, setPicked] = useState<AcceptableField[]>([]);
  const { busy, notice, run } = useAction();
  const accept = () =>
    run('accept', async () => {
      const r = await sendJson<{ applied: string[]; skipped: string[] }>('POST', `/api/admin/growth/briefs/${brief.id}/accept`, { fields: picked });
      setPicked([]);
      return `Accepted: ${r.applied.join(', ') || 'nothing new'}.${r.skipped.length ? ` Skipped: ${r.skipped.join('; ')}.` : ''}`;
    });
  return (
    <article style={{ borderTop: `1px solid ${ADMIN_COLORS.border}`, padding: '14px 0' }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
        <strong style={{ fontSize: 13 }}>{dateTime(brief.created_at)}</strong>
        {brief.is_mock && <MockBadge />}
        {brief.is_test && <span style={adminBadge('neutral')}>Test</span>}
        <span style={{ fontSize: 11, color: ADMIN_COLORS.textMuted }}>
          {brief.model}
          {brief.created_by_name ? `, requested by ${brief.created_by_name}` : ''}
        </span>
        {brief.accepted.length > 0 && <span style={adminBadge('success')}>Accepted: {brief.accepted.join(', ')}</span>}
      </div>
      {brief.is_mock && <p style={{ margin: '0 0 8px', fontSize: 12, color: ADMIN_COLORS.warning }}>Sample output from the mock provider about a made-up company. It is not research and cannot be accepted.</p>}
      <Fact label="Summary" f={c.summary} />
      <Fact label="Sector" f={c.sector} />
      <Fact label="City" f={c.city} />
      {c.projects?.length > 0 && (
        <div style={{ fontSize: 13, marginTop: 6 }}>
          <strong>Projects</strong>
          <ul style={{ margin: '4px 0', paddingLeft: 18 }}>
            {c.projects.map((p) => (
              <li key={p.name}>
                {p.name}
                {p.scale_sar ? ` (${sar(p.scale_sar)})` : ''}: {p.detail}
                <Sources urls={p.sources} />
              </li>
            ))}
          </ul>
        </div>
      )}
      {c.recent_triggers?.length > 0 && (
        <div style={{ fontSize: 13, marginTop: 6 }}>
          <strong>Recent triggers</strong>
          <ul style={{ margin: '4px 0', paddingLeft: 18 }}>
            {c.recent_triggers.map((t) => (
              <li key={t.summary}>
                {t.date ?? 'Undated'}: {t.summary}
                <Sources urls={t.sources} />
              </li>
            ))}
          </ul>
        </div>
      )}
      {c.decision_makers?.length > 0 && (
        <div style={{ fontSize: 13, marginTop: 6 }}>
          <strong>Decision-makers</strong>
          <ul style={{ margin: '4px 0', paddingLeft: 18 }}>
            {c.decision_makers.map((p) => (
              <li key={p.name}>
                {p.name}
                {p.title ? `, ${p.title}` : ''}
                <Sources urls={p.sources} />
              </li>
            ))}
          </ul>
        </div>
      )}
      <p style={{ margin: '6px 0', fontSize: 13 }}>
        <strong>Likely service:</strong> {c.likely_service?.value ? serviceLabel(c.likely_service.value) : 'Not clear'}
        {c.likely_service?.reason ? `. ${c.likely_service.reason}` : ''}
      </p>
      <p style={{ margin: '6px 0', fontSize: 13 }}>
        <strong>Suggested entry offer:</strong> {c.entry_offer?.value ?? 'None'}
        {c.entry_offer?.reason ? `. ${c.entry_offer.reason}` : ''}
      </p>
      {c.reasoning && <p style={{ margin: '6px 0', fontSize: 13, color: ADMIN_COLORS.textBody }}>{c.reasoning}</p>}
      {c.unknowns?.length > 0 && <p style={{ margin: '6px 0', fontSize: 12, color: ADMIN_COLORS.textMuted }}>Unknown: {c.unknowns.join('; ')}</p>}
      {c.dropped?.length > 0 && <p style={{ margin: '6px 0', fontSize: 12, color: ADMIN_COLORS.warning }}>Dropped for lack of a source: {c.dropped.join('; ')}</p>}
      {!brief.is_mock && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700 }}>Accept into the profile</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {ACCEPTABLE_FIELDS.map((f) => (
              <label key={f.key} style={{ fontSize: 12, display: 'flex', gap: 4, alignItems: 'center' }}>
                <input type="checkbox" checked={picked.includes(f.key)} onChange={(e) => setPicked(e.target.checked ? [...picked, f.key] : picked.filter((x) => x !== f.key))} />
                {f.label}
              </label>
            ))}
          </div>
          <div>
            <PrimaryButton onClick={accept} disabled={busy !== null || picked.length === 0}>
              Accept selected
            </PrimaryButton>
          </div>
          <NoticeLine notice={notice} />
        </div>
      )}
    </article>
  );
}

/** Runs the Research Agent and lists every brief kept for the company, newest first. */
export function ResearchPanel({ companyId, briefs, available }: { companyId: string; briefs: Brief[]; available: boolean }) {
  const { busy, notice, run } = useAction();
  const research = () =>
    run('research', async () => {
      const r = await sendJson<{ mock: boolean }>('POST', `/api/admin/growth/companies/${companyId}/research`);
      return r.mock ? 'A mock brief was added (no Anthropic key is set).' : 'A research brief was added below.';
    });
  return (
    <section style={adminCard} aria-labelledby="research">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <h2 id="research" style={{ margin: 0, fontSize: 15, fontWeight: 700, color: ADMIN_COLORS.textHeading }}>
          Research briefs
        </h2>
        <PrimaryButton onClick={research} disabled={busy !== null || !available}>
          {busy ? 'Researching (this can take a minute)' : 'Run research'}
        </PrimaryButton>
      </div>
      <p style={{ margin: '6px 0 0', fontSize: 12, color: ADMIN_COLORS.textMuted }}>
        {available
          ? 'The agent searches the web and keeps only facts with a source the search returned. It needs approved services and offers in the Knowledge Base and a monthly AI budget. Nothing changes on the profile until you accept it.'
          : 'Research needs 088_growth_prospecting.sql applied first.'}
      </p>
      <NoticeLine notice={notice} />
      {briefs.length === 0 ? <p style={{ margin: '12px 0 0', fontSize: 13, color: ADMIN_COLORS.textMuted }}>No briefs yet.</p> : briefs.map((b) => <BriefView key={b.id} brief={b} />)}
    </section>
  );
}
