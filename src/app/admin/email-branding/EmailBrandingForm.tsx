'use client';

import { useState } from 'react';

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
import type { EmailBranding } from '@/lib/cms/emailBranding';

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

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
    <div
      style={{
        display: 'grid',
        gap: 18,
        gridTemplateColumns: 'minmax(0, 1fr) 420px',
        alignItems: 'start',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <section style={adminCard}>
          <h2
            style={{
              margin: '0 0 14px',
              fontSize: 14,
              fontWeight: 700,
              color: ADMIN_COLORS.textHeading,
            }}
          >
            Header
          </h2>
          <label style={{ display: 'block' }}>
            <span style={adminLabel}>Logo URL</span>
            <input
              type="text"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://… or /logo-email.png"
              style={adminInput}
            />
          </label>
          <label style={{ display: 'block', marginTop: 14 }}>
            <span style={adminLabel}>Primary color</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="color"
                value={colorValid ? primaryColor : '#1B3A5F'}
                onChange={(e) => setPrimaryColor(e.target.value)}
                style={{
                  width: 44,
                  height: 36,
                  padding: 2,
                  border: `1px solid ${ADMIN_COLORS.borderInput}`,
                  borderRadius: 7,
                  background: '#FFFFFF',
                  cursor: 'pointer',
                }}
              />
              <input
                type="text"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                style={adminInput}
              />
            </div>
            {!colorValid && (
              <p style={{ margin: '6px 0 0', fontSize: 11, color: ADMIN_COLORS.danger }}>
                Use a hex value like #1B3A5F
              </p>
            )}
          </label>
        </section>

        <section style={adminCard}>
          <h2
            style={{
              margin: '0 0 6px',
              fontSize: 14,
              fontWeight: 700,
              color: ADMIN_COLORS.textHeading,
            }}
          >
            Signature
          </h2>
          <p style={{ margin: '0 0 12px', fontSize: 12, color: ADMIN_COLORS.textMuted }}>
            Appended to outgoing transactional emails (above the footer).
          </p>
          <RichTextEditor
            value={signatureHtml}
            onChange={setSignatureHtml}
            ariaLabel="Email signature editor"
          />
        </section>

        <section style={adminCard}>
          <h2
            style={{
              margin: '0 0 6px',
              fontSize: 14,
              fontWeight: 700,
              color: ADMIN_COLORS.textHeading,
            }}
          >
            Footer
          </h2>
          <p style={{ margin: '0 0 12px', fontSize: 12, color: ADMIN_COLORS.textMuted }}>
            Renders in a muted block at the bottom of every transactional email.
          </p>
          <RichTextEditor
            value={footerHtml}
            onChange={setFooterHtml}
            ariaLabel="Email footer editor"
          />
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
            {state === 'saving' ? 'Saving…' : 'Save email branding'}
          </button>
        </div>
      </div>

      <aside style={{ position: 'sticky', top: 24, alignSelf: 'start' }}>
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
    <div
      style={{
        background: '#F4F7FC',
        border: `1px solid ${ADMIN_COLORS.border}`,
        borderRadius: 12,
        padding: 16,
      }}
    >
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: 8,
          overflow: 'hidden',
          boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
          fontFamily: "system-ui, -apple-system, 'Segoe UI', Arial, sans-serif",
        }}
      >
        <div
          style={{
            background: primaryColor,
            color: '#FFFFFF',
            textAlign: 'center',
            padding: '16px 20px',
          }}
        >
          {logoUrl ? (
            <img
              src={logoUrl}
              alt=""
              style={{ height: 28, margin: '0 auto', display: 'block' }}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <span
              style={{
                fontSize: 14,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              PaceMakers
            </span>
          )}
        </div>
        <div style={{ padding: 20, fontSize: 14, color: ADMIN_COLORS.textHeading }}>
          <p style={{ margin: 0 }}>This is a preview of how the email body will render.</p>
          <p style={{ margin: '12px 0 0' }}>A real message would appear in this column.</p>
          {signatureHtml && (
            <div
              style={{
                marginTop: 18,
                paddingTop: 14,
                borderTop: `1px solid ${ADMIN_COLORS.border}`,
                fontSize: 13,
              }}
              dangerouslySetInnerHTML={{ __html: signatureHtml }}
            />
          )}
        </div>
        {footerHtml && (
          <div
            style={{
              borderTop: `1px solid ${ADMIN_COLORS.border}`,
              background: '#F9FAFB',
              padding: '14px 20px',
              fontSize: 12,
              color: ADMIN_COLORS.textMuted,
            }}
            dangerouslySetInnerHTML={{ __html: footerHtml }}
          />
        )}
      </div>
    </div>
  );
}
