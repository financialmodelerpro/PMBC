'use client';

import { useState } from 'react';

import { SaveStatus, type SaveState } from '@/components/admin/SaveStatus';
import { RichTextEditor } from '@/components/admin/RichTextEditor';
import type { EmailTemplate } from '@/lib/cms/emailTemplates';
import { TEMPLATE_VARIABLES } from '@/lib/cms/emailTemplates';

const TEMPLATE_LABELS: Record<string, string> = {
  contact_notification: 'Contact form — admin notification',
  contact_acknowledgement: 'Contact form — sender acknowledgement',
};

const inputCls =
  'block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-[14px] text-[#0F1B2D] outline-none focus:border-[#1B3A5F] focus:ring-2 focus:ring-[#1B3A5F]/15';

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
      <div className="rounded-lg border border-neutral-200 bg-white p-6 text-sm text-neutral-500">
        No email templates found. Run migration 008 to seed defaults.
      </div>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[220px_1fr_240px]">
      <aside>
        <p className="mb-2 text-[11px] font-medium tracking-[0.16em] uppercase text-neutral-500">
          Templates
        </p>
        <ul className="space-y-1">
          {templates.map((t) => {
            const isActive = t.template_key === activeKey;
            return (
              <li key={t.template_key}>
                <button
                  type="button"
                  onClick={() => setActiveKey(t.template_key)}
                  className={
                    'block w-full rounded-md px-3 py-2 text-left text-sm transition ' +
                    (isActive
                      ? 'bg-[#1B3A5F] text-white'
                      : 'text-[#0F1B2D] hover:bg-neutral-100')
                  }
                >
                  <p className="font-medium">
                    {TEMPLATE_LABELS[t.template_key] ?? t.template_key}
                  </p>
                  <p
                    className={
                      'mt-0.5 font-mono text-[11px] ' +
                      (isActive ? 'text-white/70' : 'text-neutral-500')
                    }
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
        <div className="space-y-5">
          <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,27,45,0.04)]">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-sm font-semibold text-[#0F1B2D]">
                {TEMPLATE_LABELS[active.template_key] ?? active.template_key}
              </h2>
              <label className="inline-flex items-center gap-2 text-xs text-[#0F1B2D]">
                <input
                  type="checkbox"
                  checked={active.enabled}
                  onChange={(e) => update(active.template_key, { enabled: e.target.checked })}
                  className="h-4 w-4"
                />
                Enabled
              </label>
            </div>
            <label className="mt-4 block">
              <span className="mb-1.5 block text-xs font-medium text-[#0F2540]">Subject</span>
              <input
                type="text"
                value={active.subject}
                onChange={(e) => update(active.template_key, { subject: e.target.value })}
                className={inputCls}
              />
            </label>
            <div className="mt-4">
              <p className="mb-1.5 text-xs font-medium text-[#0F2540]">Body</p>
              <RichTextEditor
                value={active.body_html}
                onChange={(html) => update(active.template_key, { body_html: html })}
                ariaLabel="Email body editor"
                minHeight={240}
              />
            </div>
          </section>

          <div className="flex items-center justify-between border-t border-neutral-200 pt-5">
            <SaveStatus state={state} message={errMsg} />
            <button
              type="button"
              onClick={onSave}
              disabled={state === 'saving'}
              className="rounded-md bg-[#1B3A5F] px-4 py-2 text-sm font-medium text-white hover:bg-[#0F2540] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {state === 'saving' ? 'Saving…' : 'Save all templates'}
            </button>
          </div>
        </div>
      ) : (
        <div className="text-sm text-neutral-500">Select a template.</div>
      )}

      <aside>
        <p className="mb-2 text-[11px] font-medium tracking-[0.16em] uppercase text-neutral-500">
          Available variables
        </p>
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          {active && (TEMPLATE_VARIABLES[active.template_key] ?? []).length > 0 ? (
            <>
              <p className="mb-2 text-xs text-neutral-500">
                Use <code className="rounded bg-neutral-100 px-1 py-0.5">{'{{name}}'}</code> syntax
                inside subject or body. They are substituted at send time.
              </p>
              <ul className="space-y-1">
                {(TEMPLATE_VARIABLES[active.template_key] ?? []).map((v) => (
                  <li
                    key={v}
                    className="flex items-center justify-between rounded border border-neutral-200 bg-neutral-50 px-2.5 py-1.5"
                  >
                    <code className="text-[12px] text-[#0F1B2D]">{`{{${v}}}`}</code>
                    <CopyButton text={`{{${v}}}`} />
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-xs text-neutral-500">No variables defined for this template.</p>
          )}
        </div>
      </aside>
    </div>
  );
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
      className="text-[10px] uppercase tracking-wider text-neutral-500 hover:text-[#1B3A5F]"
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}
