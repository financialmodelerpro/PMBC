'use client';

import { useEffect } from 'react';

import {
  ADMIN_COLORS,
  adminButtonGhost,
} from '@/lib/admin/styles';
import { SECTION_TYPES } from '@/lib/cms/sectionTypes';

export function SectionPickerDialog({
  open,
  onPick,
  onClose,
}: {
  open: boolean;
  onPick: (sectionType: string) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 70,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(15,37,64,0.5)',
        }}
      />
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 720,
          margin: 16,
          background: '#FFFFFF',
          border: `1px solid ${ADMIN_COLORS.border}`,
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 12px 32px rgba(0,0,0,0.18)',
        }}
      >
        <div
          style={{
            padding: '16px 20px',
            borderBottom: `1px solid ${ADMIN_COLORS.border}`,
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 700,
              color: ADMIN_COLORS.textHeading,
            }}
          >
            Add section
          </h3>
          <p
            style={{
              margin: '4px 0 0',
              fontSize: 12,
              color: ADMIN_COLORS.textMuted,
            }}
          >
            Pick a section type. Editors marked Phase 6 still create rows but render as
            placeholders for now.
          </p>
        </div>
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 1,
            background: ADMIN_COLORS.border,
            maxHeight: '60vh',
            overflowY: 'auto',
          }}
        >
          {SECTION_TYPES.map((meta) => (
            <li key={meta.type}>
              <button
                type="button"
                onClick={() => onPick(meta.type)}
                style={{
                  width: '100%',
                  height: '100%',
                  textAlign: 'left',
                  background: '#FFFFFF',
                  border: 'none',
                  padding: 14,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  fontFamily: 'inherit',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = ADMIN_COLORS.altBg;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#FFFFFF';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                      fontSize: 11,
                      color: ADMIN_COLORS.textMuted,
                    }}
                  >
                    {meta.type}
                  </span>
                  {!meta.implemented && (
                    <span
                      style={{
                        padding: '1px 8px',
                        borderRadius: 999,
                        background: ADMIN_COLORS.warningBg,
                        color: ADMIN_COLORS.warning,
                        fontSize: 10,
                        fontWeight: 600,
                      }}
                    >
                      Phase 6
                    </span>
                  )}
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    fontWeight: 600,
                    color: ADMIN_COLORS.textHeading,
                  }}
                >
                  {meta.label}
                </p>
                <p style={{ margin: 0, fontSize: 12, color: ADMIN_COLORS.textMuted }}>
                  {meta.description}
                </p>
              </button>
            </li>
          ))}
        </ul>
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            padding: '12px 20px',
            borderTop: `1px solid ${ADMIN_COLORS.border}`,
          }}
        >
          <button type="button" onClick={onClose} style={adminButtonGhost}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
