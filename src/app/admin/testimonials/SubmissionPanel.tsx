'use client';

import { useCallback, useEffect, useState } from 'react';

import { ToggleSwitch } from '@/components/admin/ToggleSwitch';
import { TestimonialLinksPanel } from './TestimonialLinksPanel';
import { ADMIN_COLORS, adminCard, adminFieldHint } from '@/lib/admin/styles';

/**
 * Everything about collecting testimonials, on the screen that reviews them.
 *
 * This was two sidebar entries until 2026-08-16: Testimonials, and a separate
 * Testimonial Links. Links exist only to feed this queue, so the second entry
 * was a navigation item for a sub-feature, and finding the link that produced a
 * pending testimonial meant leaving the queue to look it up.
 *
 * The switch above the links is the other half: whether the form is offered
 * publicly at all. One answer for the whole site, set here rather than by
 * toggling a section on each page it was placed on, which is how a form ends up
 * left on somewhere nobody remembered.
 */
export function SubmissionPanel() {
  const [publicEnabled, setPublicEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [canEdit, setCanEdit] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/settings');
      const json = (await res.json()) as {
        settings?: Record<string, unknown>;
        row?: { settings?: Record<string, unknown> };
        error?: string;
      };
      if (res.status === 403) {
        // An editor. The switch is a site-wide setting and stays admin only, so
        // it is not offered rather than being offered and refused.
        setCanEdit(false);
        setPublicEnabled(null);
        return;
      }
      const settings = json.settings ?? json.row?.settings ?? {};
      setPublicEnabled(settings.testimonial_form_public === true);
      if (json.error) setError(json.error);
    } catch {
      setError('Could not read the setting.');
      setPublicEnabled(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggle(next: boolean) {
    setBusy(true);
    setError(null);
    // Optimistic, then corrected by the reload below if the write failed. The
    // switch is the thing being clicked, so it should move when clicked.
    setPublicEnabled(next);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testimonial_form_public: next }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? 'Could not save the setting.');
        await load();
      }
    } catch {
      setError('Could not reach the server.');
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ ...adminCard, marginBottom: 22 }}>
      <p
        style={{
          margin: '0 0 14px',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: ADMIN_COLORS.textMuted,
        }}
      >
        Collecting testimonials
      </p>

      {canEdit ? (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ paddingTop: 2 }}>
            <ToggleSwitch
              checked={publicEnabled === true}
              busy={busy || publicEnabled === null}
              onChange={toggle}
              label="Show the testimonial form to the public"
            />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: ADMIN_COLORS.textHeading }}>
              Show the submission form publicly
            </p>
            <p style={{ ...adminFieldHint, marginTop: 4 }}>
              {publicEnabled
                ? 'On. The form renders on every page it has been placed on.'
                : 'Off. The form is hidden from ordinary visitors on every page, whether or not the section is there.'}{' '}
              <strong>Private links keep working either way</strong>, which is the
              point of sending one: a client opening a page with their link sees the
              form even while this is off.
            </p>
          </div>
        </div>
      ) : (
        <p style={{ ...adminFieldHint, margin: 0 }}>
          Whether the form is shown publicly is a site-wide setting, so it is
          changed by an admin. You can still create and revoke private links below,
          and review everything that comes in.
        </p>
      )}

      {error && (
        <p style={{ margin: '12px 0 0', fontSize: 13, color: ADMIN_COLORS.danger }}>{error}</p>
      )}

      <div
        style={{
          marginTop: 22,
          paddingTop: 18,
          borderTop: `1px solid ${ADMIN_COLORS.border}`,
        }}
      >
        <TestimonialLinksPanel />
      </div>
    </div>
  );
}
