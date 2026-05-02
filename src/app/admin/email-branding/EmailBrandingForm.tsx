'use client';

import { useState } from 'react';

import { SaveStatus, type SaveState } from '@/components/admin/SaveStatus';
import { RichTextEditor } from '@/components/admin/RichTextEditor';
import type { EmailBranding } from '@/lib/cms/emailBranding';

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

const inputCls =
  'block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-[14px] text-[#0F1B2D] outline-none focus:border-[#1B3A5F] focus:ring-2 focus:ring-[#1B3A5F]/15';

export function EmailBrandingForm({ initial }: { initial: EmailBranding }) {
  const [logoUrl, setLogoUrl] = useState(initial.logo_url ?? '');
  const [primaryColor, setPrimaryColor] = useState(initial.primary_color);
  const [signatureHtml, setSignatureHtml] = useState(initial.signature_html ?? '');
  const [footerHtml, setFooterHtml] = useState(initial.footer_html ?? '');
  const [state, setState] = useState<SaveState>('idle');
  const [errMsg, setErrMsg] = useState<string | undefined>();

  const colorValid = HEX.test(primaryColor);

  const onSave = async () => {
    if (!colorValid) {
      setState('error');
      setErrMsg('primary_color must be a hex value');
      return;
    }
    setState('saving');
    setErrMsg(undefined);
    try {
      const res = await fetch('/api/admin/email-branding', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          logo_url: logoUrl.trim() || null,
          primary_color: primaryColor,
          signature_html: signatureHtml || null,
          footer_html: footerHtml || null,
        }),
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

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
      <div className="space-y-5">
        <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,27,45,0.04)]">
          <h2 className="mb-4 text-sm font-semibold text-[#0F1B2D]">Header</h2>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-[#0F2540]">Logo URL</span>
            <input
              type="text"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://… or /logo-email.png"
              className={inputCls}
            />
          </label>
          <label className="mt-4 block">
            <span className="mb-1.5 block text-xs font-medium text-[#0F2540]">Primary color</span>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={colorValid ? primaryColor : '#1B3A5F'}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="h-10 w-12 cursor-pointer rounded border border-neutral-300 bg-white p-1"
              />
              <input
                type="text"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className={inputCls}
              />
            </div>
            {!colorValid && (
              <p className="mt-1 text-[11px] text-red-600">Use a hex value like #1B3A5F</p>
            )}
          </label>
        </section>

        <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,27,45,0.04)]">
          <h2 className="mb-2 text-sm font-semibold text-[#0F1B2D]">Signature</h2>
          <p className="mb-3 text-xs text-neutral-500">
            Appended to outgoing transactional emails (above the footer).
          </p>
          <RichTextEditor
            value={signatureHtml}
            onChange={setSignatureHtml}
            ariaLabel="Email signature editor"
          />
        </section>

        <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,27,45,0.04)]">
          <h2 className="mb-2 text-sm font-semibold text-[#0F1B2D]">Footer</h2>
          <p className="mb-3 text-xs text-neutral-500">
            Renders in a muted block at the bottom of every transactional email.
          </p>
          <RichTextEditor
            value={footerHtml}
            onChange={setFooterHtml}
            ariaLabel="Email footer editor"
          />
        </section>

        <div className="flex items-center justify-between border-t border-neutral-200 pt-5">
          <SaveStatus state={state} message={errMsg} />
          <button
            type="button"
            onClick={onSave}
            disabled={state === 'saving'}
            className="rounded-md bg-[#1B3A5F] px-4 py-2 text-sm font-medium text-white hover:bg-[#0F2540] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {state === 'saving' ? 'Saving…' : 'Save email branding'}
          </button>
        </div>
      </div>

      <aside className="xl:sticky xl:top-20 xl:self-start">
        <p className="mb-2 text-[11px] font-medium tracking-[0.16em] uppercase text-neutral-500">
          Preview
        </p>
        <EmailPreview
          logoUrl={logoUrl}
          primaryColor={colorValid ? primaryColor : '#1B3A5F'}
          signatureHtml={signatureHtml}
          footerHtml={footerHtml}
        />
      </aside>
    </div>
  );
}

function EmailPreview({
  logoUrl,
  primaryColor,
  signatureHtml,
  footerHtml,
}: {
  logoUrl: string;
  primaryColor: string;
  signatureHtml: string;
  footerHtml: string;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100 p-4">
      <div
        className="overflow-hidden rounded-md bg-white shadow-sm"
        style={{ fontFamily: 'system-ui, -apple-system, Segoe UI, Arial, sans-serif' }}
      >
        <div
          className="px-5 py-4 text-center"
          style={{ background: primaryColor, color: 'white' }}
        >
          {logoUrl ? (
            <img
              src={logoUrl}
              alt=""
              style={{ height: 28, margin: '0 auto' }}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <span style={{ fontSize: 14, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              PaceMakers
            </span>
          )}
        </div>
        <div className="px-5 py-5 text-sm text-[#0F1B2D]">
          <p>This is a preview of how the email body will render.</p>
          <p className="mt-3">A real message would appear in this column.</p>
          {signatureHtml && (
            <div
              className="prose prose-sm mt-5 max-w-none border-t border-neutral-200 pt-4"
              dangerouslySetInnerHTML={{ __html: signatureHtml }}
            />
          )}
        </div>
        {footerHtml && (
          <div
            className="prose prose-sm max-w-none border-t border-neutral-200 bg-neutral-50 px-5 py-4 text-xs text-neutral-500"
            dangerouslySetInnerHTML={{ __html: footerHtml }}
          />
        )}
      </div>
    </div>
  );
}
