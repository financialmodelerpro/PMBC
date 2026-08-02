'use client';

import { ADMIN_COLORS } from '@/lib/admin/styles';

/**
 * A compact on/off switch for inline table cells.
 *
 * Built for the row-level toggles introduced in parity 8 (Featured and Show on
 * homepage on testimonials, Visible and Pinned on nav items), where a checkbox
 * plus a label would not fit and a drawer round-trip is too much ceremony for
 * flipping one boolean.
 *
 * It is a real `<button role="switch">` rather than a styled checkbox so the
 * pressed state, the busy state and the disabled reason all reach assistive
 * technology. `busy` shows the write in flight and blocks a second click, which
 * matters because each toggle is its own PATCH.
 */
export function ToggleSwitch({
  checked,
  onChange,
  label,
  disabled = false,
  busy = false,
  title,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Accessible name. Not rendered: the column header carries the visible one. */
  label: string;
  disabled?: boolean;
  busy?: boolean;
  title?: string;
}) {
  const inactive = disabled || busy;
  const on = checked;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      aria-busy={busy || undefined}
      title={title}
      disabled={inactive}
      onClick={() => onChange(!on)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        width: 38,
        height: 21,
        padding: 2,
        borderRadius: 999,
        border: `1px solid ${on ? ADMIN_COLORS.save : ADMIN_COLORS.borderInput}`,
        background: on ? ADMIN_COLORS.save : '#E5E7EB',
        cursor: inactive ? 'not-allowed' : 'pointer',
        opacity: inactive ? 0.5 : 1,
        transition: 'background 120ms ease',
        boxSizing: 'border-box',
      }}
    >
      <span
        style={{
          display: 'block',
          width: 15,
          height: 15,
          borderRadius: '50%',
          background: '#FFFFFF',
          transform: on ? 'translateX(17px)' : 'translateX(0)',
          transition: 'transform 120ms ease',
          boxShadow: '0 1px 2px rgba(0,0,0,0.25)',
        }}
      />
    </button>
  );
}
