/**
 * Shared admin design tokens + inline style presets.
 *
 * Admin pages intentionally use inline styles instead of Tailwind utility
 * classes — this isolates the admin console from any future public-site
 * theming changes. PMBC's admin palette is anchored on the deeper navy
 * (#0F2540) used in the sidebar plus the gold accent (#D4A93A) reserved for
 * activation/highlight states.
 */
import type { CSSProperties } from 'react';

export const ADMIN_COLORS = {
  // Brand
  primary: '#1B3A5F', // primary action, link, page heading accent
  primaryDeep: '#0F2540', // deep navy — body headings, sidebar bg
  sidebar: '#0F2540', // sidebar background
  accent: '#D4A93A', // gold — active border, premium signal
  success: '#1B6B3F', // saved toast text
  successBg: '#E5F1EA', // saved toast bg
  danger: '#DC2626',
  dangerBg: '#FEE2E2',
  warning: '#92400E',
  warningBg: '#FEF3C7',

  // Surfaces
  pageBg: '#F4F7FC',
  cardBg: '#FFFFFF',
  altBg: '#F9FAFB',
  inputBg: '#FFFBEB', // amber tint for editable inputs (FMP convention)

  // Borders
  border: '#E5E7EB',
  borderSoft: '#E8EEF5',
  borderInput: '#D1D5DB',

  // Text
  textBody: '#374151',
  textHeading: '#0F1B2D',
  textMuted: '#6B7280',
  textMicro: '#9CA3AF',
} as const;

export const ADMIN_LAYOUT = {
  pagePadding: 40,
  pagePaddingMobile: 20,
  cardRadius: 12,
  cardPadding: 24,
  inputRadius: 7,
  buttonRadius: 8,
} as const;

// ---- presets ----

export const adminPageMain: CSSProperties = {
  flex: 1,
  padding: ADMIN_LAYOUT.pagePadding,
  background: ADMIN_COLORS.pageBg,
  minHeight: '100vh',
  boxSizing: 'border-box',
};

export const adminCard: CSSProperties = {
  background: ADMIN_COLORS.cardBg,
  border: `1px solid ${ADMIN_COLORS.border}`,
  borderRadius: ADMIN_LAYOUT.cardRadius,
  padding: ADMIN_LAYOUT.cardPadding,
};

export const adminCardCompact: CSSProperties = {
  background: ADMIN_COLORS.cardBg,
  border: `1px solid ${ADMIN_COLORS.border}`,
  borderRadius: ADMIN_LAYOUT.cardRadius,
  padding: 16,
};

export const adminInput: CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '8px 12px',
  border: `1px solid ${ADMIN_COLORS.borderInput}`,
  borderRadius: ADMIN_LAYOUT.inputRadius,
  fontSize: 13,
  color: ADMIN_COLORS.textHeading,
  // FMP convention: editable inputs carry a faint amber tint (#FFFBEB) so
  // admins recognise editable fields at a glance (CMS_REFERENCE.md §7.1).
  background: ADMIN_COLORS.inputBg,
  outline: 'none',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};

export const adminTextarea: CSSProperties = {
  ...adminInput,
  resize: 'vertical',
  minHeight: 96,
  fontFamily: 'inherit',
};

export const adminLabel: CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  color: ADMIN_COLORS.textBody,
  marginBottom: 6,
};

export const adminFieldHint: CSSProperties = {
  fontSize: 11,
  color: ADMIN_COLORS.textMicro,
};

export const adminButtonPrimary: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  padding: '9px 22px',
  background: ADMIN_COLORS.primary,
  color: '#FFFFFF',
  border: 'none',
  borderRadius: ADMIN_LAYOUT.buttonRadius,
  fontWeight: 700,
  fontSize: 13,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

export const adminButtonPrimaryDisabled: CSSProperties = {
  ...adminButtonPrimary,
  opacity: 0.55,
  cursor: 'not-allowed',
};

export const adminButtonGhost: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  padding: '7px 14px',
  background: '#FFFFFF',
  color: ADMIN_COLORS.primaryDeep,
  border: `1px solid ${ADMIN_COLORS.borderInput}`,
  borderRadius: ADMIN_LAYOUT.buttonRadius,
  fontWeight: 600,
  fontSize: 12,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

export const adminButtonDanger: CSSProperties = {
  ...adminButtonPrimary,
  background: ADMIN_COLORS.danger,
};

export const adminButtonIcon: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 32,
  height: 32,
  background: '#FFFFFF',
  color: ADMIN_COLORS.textMuted,
  border: `1px solid ${ADMIN_COLORS.border}`,
  borderRadius: 6,
  cursor: 'pointer',
};

export const adminTable: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  background: '#FFFFFF',
};

export const adminThead: CSSProperties = {
  background: ADMIN_COLORS.altBg,
  textAlign: 'left',
};

export const adminTh: CSSProperties = {
  padding: '12px 16px',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  color: ADMIN_COLORS.textMuted,
  borderBottom: `1px solid ${ADMIN_COLORS.border}`,
};

export const adminTd: CSSProperties = {
  padding: '12px 16px',
  fontSize: 13,
  color: ADMIN_COLORS.textBody,
  borderBottom: `1px solid ${ADMIN_COLORS.border}`,
};

export const adminBadge = (tone: 'neutral' | 'success' | 'warning' | 'danger'): CSSProperties => {
  const map = {
    neutral: { bg: '#F3F4F6', fg: ADMIN_COLORS.textBody },
    success: { bg: ADMIN_COLORS.successBg, fg: ADMIN_COLORS.success },
    warning: { bg: ADMIN_COLORS.warningBg, fg: ADMIN_COLORS.warning },
    danger: { bg: ADMIN_COLORS.dangerBg, fg: ADMIN_COLORS.danger },
  } as const;
  const t = map[tone];
  return {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 10px',
    borderRadius: 999,
    background: t.bg,
    color: t.fg,
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.02em',
  };
};
