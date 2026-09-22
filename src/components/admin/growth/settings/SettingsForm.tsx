'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { SaveButton } from '@/components/admin/SaveButton';
import { ADMIN_COLORS, adminCard, adminFieldHint, adminInput, adminLabel } from '@/lib/admin/styles';
import { SETTINGS_LIMITS, WEEKDAYS, parseDayList, settingsSchema, type GrowthSettings } from '@/lib/growth/settingsModel';

type Form = {
  daily_cold_email_cap: string;
  send_days: number[];
  send_start: string;
  send_end: string;
  follow_up_days: string;
  max_follow_ups: string;
  ai_monthly_budget_usd: string;
  ai_alert_threshold_pct: string;
  ai_alert_email: string;
  retention_months: string;
};

function toForm(s: GrowthSettings): Form {
  return {
    daily_cold_email_cap: String(s.daily_cold_email_cap),
    send_days: [...s.send_days],
    send_start: s.send_start,
    send_end: s.send_end,
    follow_up_days: s.follow_up_days.join(', '),
    max_follow_ups: String(s.max_follow_ups),
    ai_monthly_budget_usd: s.ai_monthly_budget_usd === null ? '' : String(s.ai_monthly_budget_usd),
    ai_alert_threshold_pct: String(s.ai_alert_threshold_pct),
    ai_alert_email: s.ai_alert_email,
    retention_months: String(s.retention_months),
  };
}

const num = (s: string) => (s.trim() === '' ? Number.NaN : Number(s));

function toInput(f: Form) {
  return {
    daily_cold_email_cap: num(f.daily_cold_email_cap),
    send_days: [...f.send_days].sort((a, b) => a - b),
    send_start: f.send_start,
    send_end: f.send_end,
    follow_up_days: parseDayList(f.follow_up_days),
    max_follow_ups: num(f.max_follow_ups),
    ai_monthly_budget_usd: f.ai_monthly_budget_usd.trim() === '' ? null : num(f.ai_monthly_budget_usd),
    ai_alert_threshold_pct: num(f.ai_alert_threshold_pct),
    ai_alert_email: f.ai_alert_email,
    retention_months: num(f.retention_months),
  };
}

/**
 * Outreach limits, the AI budget and retention, saved together. Validated here
 * with the same rules the database enforces; each change is logged with its old
 * and new value.
 */
export function SettingsForm({ settings, spentThisMonthUsd }: { settings: GrowthSettings; spentThisMonthUsd: number }) {
  const router = useRouter();
  const [saved, setSaved] = useState<Form>(() => toForm(settings));
  const [form, setForm] = useState<Form>(() => toForm(settings));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const check = settingsSchema.safeParse(toInput(form));
  const problem = check.success ? null : (check.error.issues[0]?.message ?? 'Check the values');

  async function save() {
    if (!check.success) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/growth/settings', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(check.data) });
      const data = (await res.json().catch(() => ({}))) as { error?: string; settings?: GrowthSettings };
      if (!res.ok || !data.settings) throw new Error(data.error || 'Save failed');
      const next = toForm(data.settings);
      setSaved(next);
      setForm(next);
      setMessage({ tone: 'ok', text: 'Saved. The change is in the audit log.' });
      router.refresh();
    } catch (err) {
      setMessage({ tone: 'error', text: err instanceof Error ? err.message : 'Save failed' });
    } finally {
      setSaving(false);
    }
  }

  const label = (text: string, control: React.ReactNode, hint?: string) => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      <span style={adminLabel}>{text}</span>
      {control}
      {hint && <span style={adminFieldHint}>{hint}</span>}
    </label>
  );
  const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: 16 } as const;
  const section = (title: string, children: React.ReactNode) => (
    <section style={{ ...adminCard, marginBottom: 16 }}>
      <h2 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700, color: ADMIN_COLORS.textHeading }}>{title}</h2>
      {children}
    </section>
  );
  const budget = form.ai_monthly_budget_usd.trim() === '' ? null : Number(form.ai_monthly_budget_usd);

  return (
    <fieldset disabled={saving} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      {section(
        'Outreach limits',
        <>
          <div style={grid}>
            {label('Daily cold email cap', <input type="number" min={SETTINGS_LIMITS.dailyCap.min} max={SETTINGS_LIMITS.dailyCap.max} value={form.daily_cold_email_cap} onChange={set('daily_cold_email_cap')} style={adminInput} />, 'New cold emails per day, across all contacts.')}
            {label('Sending starts', <input type="time" value={form.send_start} onChange={set('send_start')} style={adminInput} />, 'Saudi time (Asia/Riyadh).')}
            {label('Sending ends', <input type="time" value={form.send_end} onChange={set('send_end')} style={adminInput} />, 'Saudi time (Asia/Riyadh).')}
            {label('Follow-up days', <input value={form.follow_up_days} onChange={set('follow_up_days')} style={adminInput} inputMode="numeric" />, 'Days after the first email, increasing, for example 4, 10, 20.')}
            {label('Maximum follow-ups per contact', <input type="number" min={SETTINGS_LIMITS.maxFollowUps.min} max={SETTINGS_LIMITS.maxFollowUps.max} value={form.max_follow_ups} onChange={set('max_follow_ups')} style={adminInput} />)}
          </div>
          <div style={{ marginTop: 16 }}>
            <span style={adminLabel}>Sending days</span>
            <div role="group" aria-label="Sending days" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              {WEEKDAYS.map((d) => {
                const on = form.send_days.includes(d.value);
                return (
                  <label key={d.value} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '6px 10px', border: `1px solid ${on ? ADMIN_COLORS.primary : ADMIN_COLORS.border}`, borderRadius: 999, background: on ? '#EEF3F9' : '#FFFFFF' }}>
                    <input type="checkbox" checked={on} onChange={() => setForm((f) => ({ ...f, send_days: on ? f.send_days.filter((x) => x !== d.value) : [...f.send_days, d.value] }))} />
                    {d.label}
                  </label>
                );
              })}
            </div>
          </div>
        </>,
      )}
      {section(
        'AI budget',
        <>
          <div style={grid}>
            {label('Monthly budget (USD)', <input type="number" min={SETTINGS_LIMITS.budgetUsd.min} step="0.01" value={form.ai_monthly_budget_usd} onChange={set('ai_monthly_budget_usd')} placeholder="Not set" style={adminInput} />, 'Until a budget is set, AI agents will not run (enforced from Unit 1.5).')}
            {label('Alert at (percent of budget)', <input type="number" min={SETTINGS_LIMITS.thresholdPct.min} max={SETTINGS_LIMITS.thresholdPct.max} value={form.ai_alert_threshold_pct} onChange={set('ai_alert_threshold_pct')} style={adminInput} />)}
            {label('Alert recipient', <input type="email" value={form.ai_alert_email} onChange={set('ai_alert_email')} style={adminInput} />)}
          </div>
          <p style={{ margin: '14px 0 0', fontSize: 13, color: ADMIN_COLORS.textBody }}>
            Spent this month: <strong>USD {spentThisMonthUsd.toFixed(2)}</strong>
            {budget && Number.isFinite(budget) ? ` of USD ${budget.toFixed(2)}` : ''}. Spend is recorded from Unit 1.5.
          </p>
        </>,
      )}
      {section(
        'Retention',
        <div style={grid}>
          {label('Keep contacts who never replied for (months)', <input type="number" min={SETTINGS_LIMITS.retentionMonths.min} max={SETTINGS_LIMITS.retentionMonths.max} value={form.retention_months} onChange={set('retention_months')} style={adminInput} />, 'The preview below uses the saved value. Nothing is deleted in this version.')}
        </div>,
      )}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 24 }}>
        <SaveButton onClick={save} saving={saving} disabled={!dirty || Boolean(problem)}>
          {saving ? 'Saving' : 'Save settings'}
        </SaveButton>
        {dirty && problem && <span style={{ fontSize: 13, color: ADMIN_COLORS.danger }}>{problem}</span>}
        {message && <span style={{ fontSize: 13, color: message.tone === 'ok' ? ADMIN_COLORS.success : ADMIN_COLORS.danger }}>{message.text}</span>}
      </div>
    </fieldset>
  );
}
