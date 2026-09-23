'use client';

import { useState, type ReactNode } from 'react';

import { ADMIN_COLORS, adminCard, adminInput, adminTextarea } from '@/lib/admin/styles';
import { GROWTH_AGENTS } from '@/lib/growth/ai/agents';
import { DEFAULT_MODEL, MODEL_PRICES } from '@/lib/growth/ai/pricing';
import { LEAD_FACTORS, SCORING_FACTORS, type EngineGroup, type EngineSettings } from '@/lib/growth/engineSettingsModel';

import { sendJson } from '../ui/client';
import { Field, NoticeLine, PrimaryButton, grid, useAction } from '../ui/kit';

function Card({ id, title, intro, pending, children }: { id: string; title: string; intro: string; pending: string | null; children: ReactNode }) {
  return (
    <section style={{ ...adminCard, marginBottom: 16 }} aria-labelledby={id}>
      <h2 id={id} style={{ margin: 0, fontSize: 15, fontWeight: 700, color: ADMIN_COLORS.textHeading }}>
        {title}
      </h2>
      <p style={{ margin: '4px 0 14px', fontSize: 12, color: ADMIN_COLORS.textMuted }}>{intro}</p>
      {pending ? <p style={{ margin: 0, fontSize: 13, color: ADMIN_COLORS.warning }}>Needs {pending} applied before these can be saved. Shown with their defaults.</p> : null}
      <fieldset disabled={Boolean(pending)} style={{ border: 0, padding: 0, margin: pending ? '12px 0 0' : 0, opacity: pending ? 0.6 : 1 }}>
        {children}
      </fieldset>
    </section>
  );
}

function useSave(group: EngineGroup) {
  const a = useAction();
  const save = (values: Record<string, unknown>, done = 'Saved.') =>
    a.run(group, async () => {
      await sendJson('PATCH', '/api/admin/growth/settings/engine', { group, values });
      return done;
    });
  return { ...a, save };
}

export function SignalFeedForm({ values, pending }: { values: EngineSettings; pending: string | null }) {
  const [keywords, setKeywords] = useState(values.signal_keywords.join('\n'));
  const [paused, setPaused] = useState(values.signal_feed_paused);
  const [max, setMax] = useState(String(values.signal_feed_max_per_run));
  const { busy, notice, save } = useSave('signal_feed');
  return (
    <Card id="feed-settings" title="Daily signal feed" intro="The morning search (Riyadh time) uses these keywords. Every signal it keeps needs a real evidence link; duplicates are skipped; it stops at the AI budget." pending={pending}>
      <div style={grid}>
        <Field label="Keywords" hint="One per line, e.g. off-plan registration Riyadh, sukuk issuance, appoints CFO" style={{ gridColumn: '1 / -1' }}>
          <textarea value={keywords} onChange={(e) => setKeywords(e.target.value)} style={{ ...adminTextarea, minHeight: 120 }} />
        </Field>
        <Field label="Most signals kept per run">
          <input value={max} onChange={(e) => setMax(e.target.value)} style={adminInput} inputMode="numeric" />
        </Field>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
          <input type="checkbox" checked={paused} onChange={(e) => setPaused(e.target.checked)} /> Pause the morning run
        </label>
      </div>
      <div style={{ marginTop: 12 }}>
        <PrimaryButton
          disabled={busy !== null}
          onClick={() => save({ signal_keywords: keywords.split(/\r?\n/).map((k) => k.trim()).filter(Boolean), signal_feed_paused: paused, signal_feed_max_per_run: Number(max) })}
        >
          Save feed settings
        </PrimaryButton>
      </div>
      <NoticeLine notice={notice} />
    </Card>
  );
}

function WeightsEditor<K extends string>({ factors, initial, onSave, busy, label }: { factors: readonly { key: K; label: string; hint?: string }[]; initial: Record<K, number>; onSave: (w: Record<K, number>) => void; busy: boolean; label: string }) {
  const [w, setW] = useState<Record<K, string>>(Object.fromEntries(factors.map((f) => [f.key, String(initial[f.key] ?? 0)])) as Record<K, string>);
  const total = factors.reduce((a, f) => a + (Number(w[f.key]) || 0), 0);
  return (
    <>
      <div style={grid}>
        {factors.map((f) => (
          <Field key={f.key} label={f.label} hint={f.hint}>
            <input value={w[f.key]} onChange={(e) => setW({ ...w, [f.key]: e.target.value })} style={adminInput} inputMode="numeric" />
          </Field>
        ))}
      </div>
      <p style={{ margin: '10px 0', fontSize: 13, color: total === 100 ? ADMIN_COLORS.success : ADMIN_COLORS.danger }}>Total {total} of 100</p>
      <PrimaryButton disabled={busy || total !== 100} onClick={() => onSave(Object.fromEntries(factors.map((f) => [f.key, Number(w[f.key])])) as Record<K, number>)}>
        {label}
      </PrimaryButton>
    </>
  );
}

export function ScoringWeightsForm({ values, pending }: { values: EngineSettings; pending: string | null }) {
  const { busy, notice, save } = useSave('scoring');
  return (
    <Card id="scoring-settings" title="Prospect Score weights" intro="Seven factors that must add up to 100. Bands: Priority 80 and over, Good 60 to 79, Watch 40 to 59, Low under 40. A known size under SAR 50 million is always Low. Companies rescore when their data changes, or with Rescore now." pending={pending}>
      <WeightsEditor factors={SCORING_FACTORS} initial={values.scoring_weights} busy={busy !== null} label="Save weights" onSave={(w) => save({ scoring_weights: w }, 'Weights saved. Scores update as each company next changes, or with Rescore now.')} />
      <NoticeLine notice={notice} />
    </Card>
  );
}

export function LeadWeightsForm({ values, pending }: { values: EngineSettings; pending: string | null }) {
  const { busy, notice, save } = useSave('outreach');
  const [paused, setPaused] = useState(values.outreach_sending_paused);
  const [weights, setWeights] = useState(values.lead_scoring_weights);
  return (
    <Card id="outreach-settings" title="Outreach and Lead Score" intro="Pause stops every outreach send at once. Lead Score weights must add up to 100: Hot 71 and over, Warm 41 to 70, Cold 40 and under. A meeting request is always Hot; a known size under SAR 50 million caps at Cold." pending={pending}>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, marginBottom: 12 }}>
        <input type="checkbox" checked={paused} onChange={(e) => setPaused(e.target.checked)} /> Pause all outreach sending
      </label>
      <WeightsEditor
        factors={LEAD_FACTORS}
        initial={weights}
        busy={busy !== null}
        label="Save outreach settings"
        onSave={(w) => {
          setWeights(w);
          save({ outreach_sending_paused: paused, lead_scoring_weights: w });
        }}
      />
      <NoticeLine notice={notice} />
    </Card>
  );
}

export function AgentModelsForm({ values, pending }: { values: EngineSettings; pending: string | null }) {
  const [models, setModels] = useState<Record<string, string>>(values.agent_models);
  const { busy, notice, save } = useSave('agent_models');
  return (
    <Card id="model-settings" title="AI models by agent" intro={`Every agent runs on ${DEFAULT_MODEL} unless changed here. Opus costs about two and a half times as much; use it only where an agent's output is clearly not good enough.`} pending={pending}>
      <div style={grid}>
        {GROWTH_AGENTS.map((a) => (
          <Field key={a.key} label={a.label} hint={a.purpose}>
            <select value={models[a.key] ?? ''} onChange={(e) => setModels({ ...models, [a.key]: e.target.value })} style={adminInput}>
              <option value="">Default ({DEFAULT_MODEL})</option>
              {Object.keys(MODEL_PRICES).map((m) => (
                <option key={m} value={m}>
                  {m} (USD {MODEL_PRICES[m].inputPerMTok} / {MODEL_PRICES[m].outputPerMTok} per million tokens)
                </option>
              ))}
            </select>
          </Field>
        ))}
      </div>
      <div style={{ marginTop: 12 }}>
        <PrimaryButton disabled={busy !== null} onClick={() => save({ agent_models: Object.fromEntries(Object.entries(models).filter(([, m]) => m)) })}>
          Save models
        </PrimaryButton>
      </div>
      <NoticeLine notice={notice} />
    </Card>
  );
}

export function ChatSettingsForm({ values, pending, mock }: { values: EngineSettings; pending: string | null; mock: boolean }) {
  const [v, setV] = useState({ enabled: values.chat_widget_enabled, max: String(values.chat_max_messages), perIp: String(values.chat_max_conversations_per_ip_per_day), consent: values.chat_consent_text, alert: values.lead_alert_email });
  const [confirm, setConfirm] = useState(false);
  const { busy, notice, save } = useSave('chat');
  const turningOn = v.enabled && !values.chat_widget_enabled;
  return (
    <Card id="chat-settings" title="Website chat" intro="Off by default. While off, nothing at all is added to the public website. Switching it on adds the chat to every public page, but only once the Anthropic key is set: visitors never see mock replies." pending={pending}>
      <div style={grid}>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, fontWeight: 700 }}>
          <input type="checkbox" checked={v.enabled} onChange={(e) => setV({ ...v, enabled: e.target.checked })} /> Show the chat on the website
        </label>
        <Field label="Most messages per conversation">
          <input value={v.max} onChange={(e) => setV({ ...v, max: e.target.value })} style={adminInput} inputMode="numeric" />
        </Field>
        <Field label="Most new conversations per visitor a day">
          <input value={v.perIp} onChange={(e) => setV({ ...v, perIp: e.target.value })} style={adminInput} inputMode="numeric" />
        </Field>
        <Field label="Alerts for Hot leads and escalations go to">
          <input value={v.alert} onChange={(e) => setV({ ...v, alert: e.target.value })} style={adminInput} />
        </Field>
        <Field label="Consent wording" hint="Shown beside the consent box and recorded with every consent" style={{ gridColumn: '1 / -1' }}>
          <textarea value={v.consent} onChange={(e) => setV({ ...v, consent: e.target.value })} style={{ ...adminTextarea, minHeight: 72 }} />
        </Field>
      </div>
      {turningOn && (
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, marginTop: 10, color: ADMIN_COLORS.warning }}>
          <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} /> I understand the chat will appear on every public page{mock ? ' as soon as the Anthropic key is set' : ' within a minute'}.
        </label>
      )}
      <div style={{ marginTop: 12 }}>
        <PrimaryButton
          disabled={busy !== null || (turningOn && !confirm)}
          onClick={() => save({ chat_widget_enabled: v.enabled, chat_max_messages: Number(v.max), chat_max_conversations_per_ip_per_day: Number(v.perIp), chat_consent_text: v.consent, lead_alert_email: v.alert }, v.enabled ? 'Saved. The chat is switched on.' : 'Saved. The chat is off.')}
        >
          Save chat settings
        </PrimaryButton>
      </div>
      <NoticeLine notice={notice} />
    </Card>
  );
}
