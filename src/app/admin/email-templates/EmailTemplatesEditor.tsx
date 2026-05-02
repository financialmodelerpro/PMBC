'use client';

import { useState, type CSSProperties } from 'react';

import { SaveStatus, type SaveState } from '@/components/admin/SaveStatus';
import { RichTextEditor } from '@/components/admin/RichTextEditor';
import {
  ADMIN_COLORS,
  adminButtonPrimary,
  adminButtonPrimaryDisabled,
  adminCard,
  adminInput,
  adminLabel,
} from '@/lib/admin/styles';
import type { EmailTemplate } from '@/lib/cms/emailTemplates';
import { TEMPLATE_VARIABLES } from '@/lib/cms/emailTemplates';

const TEMPLATE_LABELS: Record<string, string> = {
  contact_notification: 'Contact form — admin notification',
  contact_acknowledgement: 'Contact form — sender acknowledgement',
};

type LocalTemplate = {
  template_key: string;
  subject: string;
  body_html: string;
  enabled: boolean;
};

export function EmailTemplatesEditor({ initial }: { initial: EmailTemplate[] }) {
  const [templates, setTemplates] = useState<LocalTemplate[]>(() =>
    initial.map((t) => ({
      template_key: t.template_key,
      subject: t.subject,
      body_html: t.body_html,
      enabled: t.enabled,
    })),
  );
  const [activeKey, setActiveKey] = useState<string | null>(
    initial[0]?.template_key ?? null,
  );
  const [state, setState] = useState<SaveState>('idle');
  const [errMsg, setErrMsg] = useState<string | undefined>();

  const active = templates.find((t) => t.template_key === activeKey) ?? null;

  const update = (key: string, patch: Partial<LocalTemplate>) => {
    setTemplates((arr) => arr.map((t) => (t.template_key === key ? { ...t, ...patch } : t)));
  };

  const onSave = async () => {
    setState('saving');
    setErrMsg(undefined);
    try {
      const res = await fetch('/api/admin/email-templates', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ templates }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Save failed');
      }
      setState('saved');
      setTimeout(() => setState('idle'), 2500);
    } catch (e) {
      setState('error');
      setErrMsg((e as Error).message);
    }
  };

  if (templates.length === 0) {
    return (
      <div
        style={{
          background: '#FFFFFF',
          border: `1px solid ${ADMIN_COLORS.border}`,
          borderRadius: 12,
          padding: 22,
          fontSize: 13,
          color: ADMIN_COLORS.textMuted,
        }}
      >
        No email templates found. Run migration 008 to seed defaults.
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'grid',
        gap: 18,
        gridTemplateColumns: '220px minmax(0, 1fr) 240px',
        alignItems: 'start',
      }}
    >
      <aside>
        <p
          style={{
            margin: '0 0 8px',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: ADMIN_COLORS.textMuted,
          }}
        >
          Templates
        </p>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {templates.map((t) => {
            const isActive = t.template_key === activeKey;
            return (
              <li key={t.template_key} style={{ marginBottom: 4 }}>
                <button
                  type="button"
                  onClick={() => setActiveKey(t.template_key)}
                  style={tplButtonStyle(isActive)}
                >
                  <p
                    style={{
                      margin: 0,
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    {TEMPLATE_LABELS[t.template_key] ?? t.template_key}
                  </p>
                  <p
                    style={{
                      margin: '2px 0 0',
                      fontFamily: 'ui-monospace, monospace',
                      fontSize: 11,
                      color: isActive ? 'rgba(255,255,255,0.7)' : ADMIN_COLORS.textMuted,
                    }}
                  >
                    {t.template_key}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      {active ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <section style={adminCard}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: 14,
                  fontWeight: 700,
                  color: ADMIN_COLORS.textHeading,
                }}
              >
                {TEMPLATE_LABELS[active.template_key] ?? active.template_key}
              </h2>
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 12,
                  color: ADMIN_COLORS.textHeading,
                }}
              >
                <input
                  type="checkbox"
                  checked={active.enabled}
                  onChange={(e) => update(active.template_key, { enabled: e.target.checked })}
                  style={{ width: 14, height: 14 }}
                />
                Enabled
              </label>
            </div>
            <label style={{ display: 'block', marginTop: 14 }}>
              <span style={adminLabel}>Subject</span>
              <input
                type="text"
                value={active.subject}
                onChange={(e) => update(active.template_key, { subject: e.target.value })}
                style={adminInput}
              />
            </label>
            <div style={{ marginTop: 14 }}>
              <p style={adminLabel}>Body</p>
              <RichTextEditor
                value={active.body_html}
                onChange={(html) => update(active.template_key, { body_html: html })}
                ariaLabel="Email body editor"
                minHeight={240}
              />
            </div>
          </section>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: 18,
              borderTop: `1px solid ${ADMIN_COLORS.border}`,
            }}
          >
            <SaveStatus state={state} message={errMsg} />
            <button
              type="button"
              onClick={onSave}
              disabled={state === 'saving'}
              style={state === 'saving' ? adminButtonPrimaryDisabled : adminButtonPrimary}
            >
              {state === 'saving' ? 'Saving…' : 'Save all templates'}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 13, color: ADMIN_COLORS.textMuted }}>Select a template.</div>
      )}

      <aside>
        <p
          style={{
            margin: '0 0 8px',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: ADMIN_COLORS.textMuted,
          }}
        >
          Available variables
        </p>
        <div
          style={{
            background: '#FFFFFF',
            border: `1px solid ${ADMIN_COLORS.border}`,
            borderRadius: 12,
            padding: 14,
          }}
        >
          {active && (TEMPLATE_VARIABLES[active.template_key] ?? []).length > 0 ? (
            <>
              <p
                style={{
                  margin: '0 0 10px',
                  fontSize: 12,
                  color: ADMIN_COLORS.textMuted,
                }}
              >
                Use{' '}
                <code
                  style={{
                    background: '#F3F4F6',
                    padding: '1px 6px',
                    borderRadius: 4,
                    fontSize: 11,
                  }}
                >
                  {'{{name}}'}
                </code>{' '}
                syntax inside subject or body. They are substituted at send time.
              </p>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {(TEMPLATE_VARIABLES[active.template_key] ?? []).map((v) => (
                  <li
                    key={v}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 10px',
                      background: '#F9FAFB',
                      border: `1px solid ${ADMIN_COLORS.border}`,
                      borderRadius: 6,
                      marginBottom: 4,
                    }}
                  >
                    <code style={{ fontSize: 12, color: ADMIN_COLORS.textHeading }}>
                      {`{{${v}}}`}
                    </code>
                    <CopyButton text={`{{${v}}}`} />
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p style={{ margin: 0, fontSize: 12, color: ADMIN_COLORS.textMuted }}>
              No variables defined for this template.
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}

function tplButtonStyle(active: boolean): CSSProperties {
  return {
    width: '100%',
    textAlign: 'left',
    padding: '10px 12px',
    border: `1px solid ${active ? ADMIN_COLORS.primary : ADMIN_COLORS.border}`,
    background: active ? ADMIN_COLORS.primary : '#FFFFFF',
    color: active ? '#FFFFFF' : ADMIN_COLORS.textHeading,
    borderRadius: 8,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'background 120ms ease, color 120ms ease',
  };
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      style={{
        background: 'transparent',
        border: 'none',
        fontSize: 10,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: copied ? ADMIN_COLORS.success : ADMIN_COLORS.textMuted,
        cursor: 'pointer',
      }}
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}
