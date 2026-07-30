'use client';

import Link from 'next/link';
import { useState } from 'react';

import { SaveStatus, type SaveState } from '@/components/admin/SaveStatus';
import {
  ADMIN_COLORS,
  adminButtonPrimary,
  adminButtonPrimaryDisabled,
  adminCard,
  adminInput,
  adminLabel,
} from '@/lib/admin/styles';
import type { HeaderConfig } from '@/lib/cms/headerSettings';

export function HeaderSettingsForm({ initial }: { initial: HeaderConfig }) {
  const [ctaLabel, setCtaLabel] = useState(initial.cta_label);
  const [ctaHref, setCtaHref] = useState(initial.cta_href);
  const [showCta, setShowCta] = useState(initial.show_cta);
  const [mobileMenu, setMobileMenu] = useState(initial.mobile_menu_enabled);

  const [state, setState] = useState<SaveState>('idle');
  const [errMsg, setErrMsg] = useState<string | undefined>();

  const onSave = async () => {
    setState('saving');
    setErrMsg(undefined);
    try {
      const res = await fetch('/api/admin/header-settings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          cta_label: ctaLabel,
          cta_href: ctaHref,
          show_cta: showCta,
          mobile_menu_enabled: mobileMenu,
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/*
        Navigation items moved to /admin/pages (Pages and Nav) when the nav
        became first-class `site_pages` rows in migration 027. Editing them in
        two places would give the navbar two sources of truth.
      */}
      <div
        style={{
          padding: '12px 16px',
          background: '#FFFFFF',
          border: `1px solid ${ADMIN_COLORS.border}`,
          borderRadius: 10,
          fontSize: 12.5,
          color: ADMIN_COLORS.textMuted,
          lineHeight: 1.6,
        }}
      >
        Navigation menu links are managed in{' '}
        <Link
          href="/admin/pages"
          style={{ color: ADMIN_COLORS.primaryDeep, fontWeight: 600 }}
        >
          Pages and Nav
        </Link>
        . This page controls the header CTA button and the mobile menu.
      </div>

      <section style={adminCard}>
        <h2
          style={{
            margin: '0 0 14px',
            fontSize: 14,
            fontWeight: 700,
            color: ADMIN_COLORS.textHeading,
          }}
        >
          Call to action
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <label>
            <span style={adminLabel}>CTA label</span>
            <input
              type="text"
              value={ctaLabel}
              onChange={(e) => setCtaLabel(e.target.value)}
              style={adminInput}
            />
          </label>
          <label>
            <span style={adminLabel}>CTA link</span>
            <input
              type="text"
              value={ctaHref}
              onChange={(e) => setCtaHref(e.target.value)}
              style={adminInput}
            />
          </label>
        </div>
        <label
          style={{
            marginTop: 14,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 13,
            color: ADMIN_COLORS.textHeading,
          }}
        >
          <input
            type="checkbox"
            checked={showCta}
            onChange={(e) => setShowCta(e.target.checked)}
            style={{ width: 14, height: 14 }}
          />
          Show CTA in header
        </label>
      </section>

      <section style={adminCard}>
        <h2
          style={{
            margin: '0 0 14px',
            fontSize: 14,
            fontWeight: 700,
            color: ADMIN_COLORS.textHeading,
          }}
        >
          Mobile
        </h2>
        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 13,
            color: ADMIN_COLORS.textHeading,
          }}
        >
          <input
            type="checkbox"
            checked={mobileMenu}
            onChange={(e) => setMobileMenu(e.target.checked)}
            style={{ width: 14, height: 14 }}
          />
          Enable hamburger menu on mobile
        </label>
      </section>

      <div
        style={{
          paddingTop: 18,
          borderTop: `1px solid ${ADMIN_COLORS.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <SaveStatus state={state} message={errMsg} />
        <button
          type="button"
          onClick={onSave}
          disabled={state === 'saving'}
          style={state === 'saving' ? adminButtonPrimaryDisabled : adminButtonPrimary}
        >
          {state === 'saving' ? 'Saving…' : 'Save header settings'}
        </button>
      </div>
    </div>
  );
}
