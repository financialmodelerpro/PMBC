'use client';

import Link from 'next/link';
import { useState, type CSSProperties } from 'react';

import { SaveStatus, type SaveState } from '@/components/admin/SaveStatus';
import { MediaPickerButton } from '@/components/admin/MediaPicker';
import {
  ADMIN_COLORS,
  adminButtonPrimary,
  adminButtonPrimaryDisabled,
  adminCard,
  adminInput,
  adminLabel,
} from '@/lib/admin/styles';
import type { BrandingConfig } from '@/lib/cms/branding';
import type { HeaderConfig } from '@/lib/cms/headerSettings';

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
/** Matches FMP's while-typing hex guard: allows a partial value as you type. */
const HEX_PARTIAL = /^#[0-9A-Fa-f]{0,6}$/;

type BrandValues = {
  logo_url: string;
  logo_dark_url: string;
  favicon_url: string;
  brand_name: string;
  short_name: string;
  tagline: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
};

function toBrandValues(b: BrandingConfig): BrandValues {
  return {
    logo_url: b.logo_url ?? '',
    logo_dark_url: b.logo_dark_url ?? '',
    favicon_url: b.favicon_url ?? '',
    brand_name: b.brand_name,
    short_name: b.short_name,
    tagline: b.tagline,
    primary_color: b.primary_color,
    secondary_color: b.secondary_color,
    accent_color: b.accent_color,
  };
}

export function HeaderSettingsForm({
  initialHeader,
  initialBranding,
}: {
  initialHeader: HeaderConfig;
  initialBranding: BrandingConfig | null;
}) {
  const [header, setHeader] = useState<HeaderConfig>(initialHeader);
  const [brand, setBrand] = useState<BrandValues | null>(
    initialBranding ? toBrandValues(initialBranding) : null,
  );

  const [state, setState] = useState<SaveState>('idle');
  const [errMsg, setErrMsg] = useState<string | undefined>();

  const h = <K extends keyof HeaderConfig>(key: K, value: HeaderConfig[K]) => {
    setHeader((prev) => ({ ...prev, [key]: value }));
  };
  const b = <K extends keyof BrandValues>(key: K, value: BrandValues[K]) => {
    setBrand((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  /**
   * FMP fires every write in one Promise.all from a single "Save All". Kept,
   * with one difference: PMBC sends the 17 header keys as ONE request to
   * /api/admin/header-settings rather than 17 separate PATCHes, because that
   * route already upserts a batch atomically and writes a single audit row.
   * Seventeen round trips would produce seventeen audit entries for one click.
   */
  const saveAll = async () => {
    setState('saving');
    setErrMsg(undefined);
    try {
      const requests: Promise<Response>[] = [
        fetch('/api/admin/header-settings', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            cta_label: header.cta_label,
            cta_href: header.cta_href,
            show_cta: header.show_cta,
            mobile_menu_enabled: header.mobile_menu_enabled,
            logo_enabled: header.logo_enabled,
            logo_width_px: header.logo_width_px,
            logo_height_px: header.logo_height_px,
            logo_position: header.logo_position,
            show_brand_name: header.show_brand_name,
            show_tagline: header.show_tagline,
            icon_url: header.icon_url,
            icon_as_favicon: header.icon_as_favicon,
            icon_in_header: header.icon_in_header,
            icon_size_px: header.icon_size_px,
            header_height_px: header.header_height_px,
            header_padding_top_px: header.header_padding_top_px,
            header_padding_bottom_px: header.header_padding_bottom_px,
          }),
        }),
      ];

      if (brand) {
        requests.push(
          fetch('/api/admin/branding', {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              ...brand,
              logo_url: brand.logo_url.trim() || null,
              logo_dark_url: brand.logo_dark_url.trim() || null,
              favicon_url: brand.favicon_url.trim() || null,
            }),
          }),
        );
      }

      const responses = await Promise.all(requests);
      const failed = responses.find((r) => !r.ok);
      if (failed) {
        const body = await failed.json().catch(() => ({}));
        throw new Error(body.error ?? 'Save failed');
      }

      setState('saved');
      setTimeout(() => setState('idle'), 2500);
    } catch (e) {
      setState('error');
      setErrMsg((e as Error).message);
    }
  };

  const saving = state === 'saving';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Save All at the top, matching FMP's header-settings layout. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 12,
          position: 'sticky',
          top: 0,
          zIndex: 20,
          padding: '10px 0',
          background: ADMIN_COLORS.pageBg,
        }}
      >
        <SaveStatus state={state} message={errMsg} />
        <button
          type="button"
          onClick={saveAll}
          disabled={saving}
          style={saving ? adminButtonPrimaryDisabled : adminButtonPrimary}
        >
          {saving ? 'Saving…' : 'Save All'}
        </button>
      </div>

      {!brand && (
        <div
          style={{
            background: ADMIN_COLORS.warningBg,
            border: '1px solid #FBBF24',
            borderRadius: 12,
            padding: 16,
            fontSize: 13,
            color: ADMIN_COLORS.warning,
          }}
        >
          The branding_config row is missing, so the Brand Colors, Logo and
          Branding Text cards are hidden. Run migration 003 and re-seed, then
          reload this page.
        </div>
      )}

      {/* ---- Brand Colors ---- */}
      {brand && (
        <Card
          title="Brand colours"
          description="Drives the public site palette, transactional email branding, and the OG card."
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 18 }}>
            <ColorInput
              label="Primary"
              value={brand.primary_color}
              onChange={(v) => b('primary_color', v)}
              placeholder="#1B3A5F"
            />
            <ColorInput
              label="Secondary"
              value={brand.secondary_color}
              onChange={(v) => b('secondary_color', v)}
              placeholder="#3FA663"
            />
            <ColorInput
              label="Accent"
              value={brand.accent_color}
              onChange={(v) => b('accent_color', v)}
              placeholder="#C69C3E"
            />
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
            <Swatch value={brand.primary_color} fallback="#1B3A5F" />
            <Swatch value={brand.secondary_color} fallback="#3FA663" />
            <Swatch value={brand.accent_color} fallback="#C69C3E" />
          </div>
        </Card>
      )}

      {/* ---- Logo ---- */}
      {brand && (
        <Card title="Logo">
          <Toggle
            checked={header.logo_enabled}
            onChange={(v) => h('logo_enabled', v)}
            label="Enable logo"
          />

          <div style={{ marginTop: 16 }}>
            <MediaPickerButton
              value={brand.logo_url}
              onChange={(url) => b('logo_url', url)}
              bucket="cms-assets"
              label="Logo image"
            />
          </div>

          {brand.logo_url && (
            <div style={{ marginTop: 12 }}>
              <span style={adminLabel}>Preview on navy</span>
              <div
                style={{
                  marginTop: 6,
                  padding: 14,
                  background: ADMIN_COLORS.primaryDeep,
                  borderRadius: 8,
                  display: 'inline-block',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={brand.logo_dark_url || brand.logo_url}
                  alt="Logo preview"
                  style={{
                    height: Number(header.logo_height_px) || 40,
                    width: header.logo_width_px
                      ? Number(header.logo_width_px)
                      : 'auto',
                    objectFit: 'contain',
                    display: 'block',
                  }}
                />
              </div>
            </div>
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 14,
              marginTop: 16,
            }}
          >
            <PxField
              label="Width (px)"
              value={header.logo_width_px}
              onChange={(v) => h('logo_width_px', v)}
              placeholder="auto"
            />
            <PxField
              label="Height (px)"
              value={header.logo_height_px}
              onChange={(v) => h('logo_height_px', v)}
              placeholder="40"
            />
            <label>
              <span style={adminLabel}>Position</span>
              <select
                value={header.logo_position}
                onChange={(e) =>
                  h('logo_position', e.target.value as HeaderConfig['logo_position'])
                }
                style={adminInput}
              >
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 16 }}>
            <label>
              <span style={adminLabel}>Dark logo URL</span>
              <input
                type="text"
                value={brand.logo_dark_url}
                onChange={(e) => b('logo_dark_url', e.target.value)}
                style={adminInput}
                placeholder="/logo-dark.svg or https://…"
              />
              <p style={hint}>Used on navy backgrounds. Optional.</p>
            </label>
            <label>
              <span style={adminLabel}>Favicon URL</span>
              <input
                type="text"
                value={brand.favicon_url}
                onChange={(e) => b('favicon_url', e.target.value)}
                style={adminInput}
                placeholder="/favicon.ico"
              />
            </label>
          </div>
        </Card>
      )}

      {/* ---- Branding Text ---- */}
      {brand && (
        <Card title="Branding text">
          <Toggle
            checked={header.show_brand_name}
            onChange={(v) => h('show_brand_name', v)}
            label="Show brand name (when no logo image is set)"
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 16 }}>
            <label>
              <span style={adminLabel}>Brand name</span>
              <input
                type="text"
                value={brand.brand_name}
                onChange={(e) => b('brand_name', e.target.value)}
                style={adminInput}
              />
              <p style={hint}>Full legal display name.</p>
            </label>
            <label>
              <span style={adminLabel}>Short name</span>
              <input
                type="text"
                value={brand.short_name}
                onChange={(e) => b('short_name', e.target.value)}
                style={adminInput}
              />
              <p style={hint}>Used in the navbar and compact contexts.</p>
            </label>
          </div>

          <div style={{ marginTop: 16 }}>
            <Toggle
              checked={header.show_tagline}
              onChange={(v) => h('show_tagline', v)}
              label="Show tagline in the header"
            />
          </div>
          <label style={{ display: 'block', marginTop: 14 }}>
            <span style={adminLabel}>Tagline</span>
            <input
              type="text"
              value={brand.tagline}
              onChange={(e) => b('tagline', e.target.value)}
              style={adminInput}
            />
            {/*
              FMP uses a RichTextEditor here. PMBC deliberately does not: this
              value is rendered by /api/og through satori (which takes plain
              text, not HTML) and by the footer as a text node, so stored markup
              would show up as escaped tags on the OG card and in the footer.
            */}
            <p style={hint}>
              Plain text. This value is also drawn onto the OG share card and
              printed in the footer, so markup is not supported here.
            </p>
          </label>
        </Card>
      )}

      {/* ---- Header Icon ---- */}
      <Card
        title="Header icon"
        description="A small mark shown beside the logo. Separate from the logo and the favicon."
      >
        <MediaPickerButton
          value={header.icon_url}
          onChange={(url) => h('icon_url', url)}
          bucket="cms-assets"
          label="Icon image"
        />
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginTop: 16 }}>
          <Toggle
            checked={header.icon_as_favicon}
            onChange={(v) => h('icon_as_favicon', v)}
            label="Use as favicon"
          />
          <Toggle
            checked={header.icon_in_header}
            onChange={(v) => h('icon_in_header', v)}
            label="Show in header"
          />
        </div>
        <div style={{ width: 160, marginTop: 16 }}>
          <PxField
            label="Icon size (px)"
            value={header.icon_size_px}
            onChange={(v) => h('icon_size_px', v)}
            placeholder="20"
          />
        </div>
      </Card>

      {/* ---- Header Layout ---- */}
      <Card title="Header layout">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
          <PxField
            label="Header height (px)"
            value={header.header_height_px}
            onChange={(v) => h('header_height_px', v)}
            placeholder="auto"
          />
          <PxField
            label="Padding top (px)"
            value={header.header_padding_top_px}
            onChange={(v) => h('header_padding_top_px', v)}
            placeholder="0"
          />
          <PxField
            label="Padding bottom (px)"
            value={header.header_padding_bottom_px}
            onChange={(v) => h('header_padding_bottom_px', v)}
            placeholder="0"
          />
        </div>
      </Card>

      {/* ---- Call to action (PMBC, pre-existing) ---- */}
      <Card title="Call to action">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <label>
            <span style={adminLabel}>CTA label</span>
            <input
              type="text"
              value={header.cta_label}
              onChange={(e) => h('cta_label', e.target.value)}
              style={adminInput}
            />
          </label>
          <label>
            <span style={adminLabel}>CTA link</span>
            <input
              type="text"
              value={header.cta_href}
              onChange={(e) => h('cta_href', e.target.value)}
              style={adminInput}
            />
          </label>
        </div>
        <div style={{ marginTop: 16 }}>
          <Toggle
            checked={header.show_cta}
            onChange={(v) => h('show_cta', v)}
            label="Show CTA in header"
          />
        </div>
      </Card>

      {/* ---- Mobile ---- */}
      <Card title="Mobile">
        <Toggle
          checked={header.mobile_menu_enabled}
          onChange={(v) => h('mobile_menu_enabled', v)}
          label="Enable hamburger menu on mobile"
        />
      </Card>

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
        <Link href="/admin/pages" style={{ color: ADMIN_COLORS.primaryDeep, fontWeight: 600 }}>
          Pages and Nav
        </Link>
        , which is the single source of truth for the navbar.
      </div>
    </div>
  );
}

/* ---------------- primitives ---------------- */

const hint: CSSProperties = {
  margin: '6px 0 0',
  fontSize: 11,
  color: ADMIN_COLORS.textMicro,
};

function Card({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section style={adminCard}>
      <h2
        style={{
          margin: 0,
          fontSize: 14,
          fontWeight: 800,
          color: ADMIN_COLORS.textHeading,
        }}
      >
        {title}
      </h2>
      {description && (
        <p style={{ margin: '6px 0 0', fontSize: 12, color: ADMIN_COLORS.textMuted }}>
          {description}
        </p>
      )}
      <div style={{ marginTop: 16 }}>{children}</div>
    </section>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 13,
        fontWeight: 600,
        color: ADMIN_COLORS.textBody,
        cursor: 'pointer',
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ width: 15, height: 15 }}
      />
      {label}
    </label>
  );
}

/** Whole pixels or blank. Blank means auto/inherit, matching the API contract. */
function PxField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label>
      <span style={adminLabel}>{label}</span>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => {
          const next = e.target.value;
          // Reject anything that is not digits, so the value can never fail
          // the API's regex after a round trip.
          if (/^\d*$/.test(next)) onChange(next);
        }}
        style={adminInput}
        placeholder={placeholder}
      />
    </label>
  );
}

function ColorInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const valid = HEX.test(value);
  return (
    <div>
      <span style={adminLabel}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="color"
          value={valid ? value : '#000000'}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: 40,
            height: 36,
            flexShrink: 0,
            padding: 2,
            border: `1px solid ${ADMIN_COLORS.borderInput}`,
            borderRadius: 7,
            background: '#FFFFFF',
            cursor: 'pointer',
          }}
        />
        <input
          type="text"
          value={value}
          maxLength={7}
          onChange={(e) => {
            const raw = e.target.value;
            const clean = raw.startsWith('#') ? raw : '#' + raw;
            // FMP's while-typing guard: accept partial hex so the field stays
            // editable mid-entry, and reject anything non-hex outright.
            if (HEX_PARTIAL.test(clean)) onChange(clean);
          }}
          style={{ ...adminInput, letterSpacing: '0.04em' }}
          placeholder={placeholder}
        />
      </div>
      {!valid && (
        <p style={{ margin: '6px 0 0', fontSize: 11, color: ADMIN_COLORS.danger }}>
          Use a hex value like {placeholder}
        </p>
      )}
    </div>
  );
}

function Swatch({ value, fallback }: { value: string; fallback: string }) {
  return (
    <div
      style={{
        flex: 1,
        height: 8,
        borderRadius: 4,
        background: HEX.test(value) ? value : fallback,
      }}
    />
  );
}
