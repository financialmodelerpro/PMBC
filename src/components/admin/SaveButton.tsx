'use client';

import { useState, type CSSProperties, type ReactNode } from 'react';

import {
  ADMIN_COLORS,
  adminButtonSave,
  adminButtonSaveDisabled,
} from '@/lib/admin/styles';

/**
 * The admin save/commit button.
 *
 * Green (#2EAA4A) per FMP CMS_REFERENCE.md section 7.3, adopted in parity
 * Phase 2 so "the green button commits my work" transfers between the PMBC and
 * FMP consoles. Everything else in the admin stays PMBC navy and gold.
 *
 * This exists as a component rather than a style preset because the hover state
 * cannot be expressed in an inline style, and the admin console is inline-styled
 * by design (see lib/admin/styles.ts). Without it, every call site would repeat
 * its own onMouseEnter/onMouseLeave pair.
 *
 * Use it ONLY for controls that commit work: Save, Save All, Save changes,
 * Save section, and the Create action that commits a collection drawer. Do not
 * use it for Sign in, Upload, New item, or any Confirm/Delete action; those keep
 * their existing semantics.
 */
export function SaveButton({
  children,
  onClick,
  type = 'button',
  saving = false,
  disabled = false,
  style,
  title,
  'aria-label': ariaLabel,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  /** Shows the button as busy. Implies disabled. */
  saving?: boolean;
  /** Disabled for any other reason, e.g. nothing has changed yet. */
  disabled?: boolean;
  /** Escape hatch for per-call-site tweaks such as compact padding. */
  style?: CSSProperties;
  title?: string;
  'aria-label'?: string;
}) {
  const [hover, setHover] = useState(false);
  const inactive = saving || disabled;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={inactive}
      title={title}
      aria-label={ariaLabel}
      aria-busy={saving || undefined}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onBlur={() => setHover(false)}
      style={{
        ...(inactive ? adminButtonSaveDisabled : adminButtonSave),
        ...(!inactive && hover ? { background: ADMIN_COLORS.saveHover } : null),
        ...style,
      }}
    >
      {children}
    </button>
  );
}
