'use client';

/**
 * The signal keyword library editor (2026-09-23): groups by trigger type, each
 * group and keyword switchable, keywords editable, a signal count per keyword,
 * and a reset to the defaults. Every change saves at once.
 */

import { useState } from 'react';

import { ADMIN_COLORS, adminBadge, adminCard, adminInput } from '@/lib/admin/styles';
import type { KeywordLibrary as Library, LibraryGroup, LibraryKeyword } from '@/lib/growth/keywords';
import { KEYWORD_LIMITS } from '@/lib/growth/keywordLibrary';
import { TRIGGER_TYPES, type TriggerType } from '@/lib/growth/model';

import { sendJson } from '../ui/client';
import { GhostButton, NoticeLine, PrimaryButton, useAction } from '../ui/kit';

const triggerLabel = (t: string) => TRIGGER_TYPES.find((x) => x.value === t)?.label ?? t;

function TriggerSelect({ value, onChange, label }: { value: TriggerType; onChange: (t: TriggerType) => void; label: string }) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value as TriggerType)} style={{ ...adminInput, width: 'auto', minWidth: 180 }}>
      {TRIGGER_TYPES.map((t) => (
        <option key={t.value} value={t.value}>
          {t.label}
        </option>
      ))}
    </select>
  );
}

function KeywordRow({ k, disabled, change }: { k: LibraryKeyword; disabled: boolean; change: (body: Record<string, unknown>, done: string) => Promise<boolean> }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(k.keyword);
  const [trigger, setTrigger] = useState<TriggerType>(k.trigger);
  const [confirmRemove, setConfirmRemove] = useState(false);
  return (
    <li style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', padding: '6px 0', borderTop: `1px solid ${ADMIN_COLORS.border}` }} data-keyword={k.keyword}>
      <input type="checkbox" aria-label={`Use "${k.keyword}"`} checked={k.enabled} disabled={disabled} onChange={(e) => change({ action: 'keyword_toggle', id: k.id, enabled: e.target.checked }, `"${k.keyword}" switched ${e.target.checked ? 'on' : 'off'}.`)} />
      {editing ? (
        <>
          <input aria-label="Keyword" value={text} maxLength={KEYWORD_LIMITS.keyword} onChange={(e) => setText(e.target.value)} style={{ ...adminInput, flex: '1 1 220px', width: 'auto' }} />
          <TriggerSelect label="Trigger type" value={trigger} onChange={setTrigger} />
          <PrimaryButton
            disabled={disabled}
            onClick={async () => {
              if (await change({ action: 'keyword_edit', id: k.id, keyword: text, trigger }, 'Keyword saved.')) setEditing(false);
            }}
          >
            Save
          </PrimaryButton>
          <GhostButton onClick={() => (setEditing(false), setText(k.keyword), setTrigger(k.trigger))}>Cancel</GhostButton>
        </>
      ) : (
        <>
          <span style={{ flex: '1 1 220px', fontSize: 13, color: k.enabled ? ADMIN_COLORS.textHeading : ADMIN_COLORS.textMuted }}>{k.keyword}</span>
          <span style={{ fontSize: 12, color: ADMIN_COLORS.textMuted }}>{triggerLabel(k.trigger)}</span>
          <span style={adminBadge(k.count ? 'success' : 'neutral')} title="Real signals this keyword has found" data-count={k.count}>
            {k.count} {k.count === 1 ? 'signal' : 'signals'}
          </span>
          {!k.isDefault && <span style={adminBadge('warning')}>Added</span>}
          <GhostButton disabled={disabled} onClick={() => setEditing(true)}>
            Edit
          </GhostButton>
          {confirmRemove ? (
            <>
              <GhostButton danger disabled={disabled} onClick={() => change({ action: 'keyword_remove', id: k.id }, `"${k.keyword}" removed.`)}>
                Confirm remove
              </GhostButton>
              <GhostButton onClick={() => setConfirmRemove(false)}>Keep</GhostButton>
            </>
          ) : (
            <GhostButton danger disabled={disabled} onClick={() => setConfirmRemove(true)}>
              Remove
            </GhostButton>
          )}
        </>
      )}
    </li>
  );
}

function Group({ g, disabled, change }: { g: LibraryGroup; disabled: boolean; change: (body: Record<string, unknown>, done: string) => Promise<boolean> }) {
  const [text, setText] = useState('');
  const [trigger, setTrigger] = useState<TriggerType>(g.trigger ?? 'new_project');
  const on = g.keywords.filter((k) => k.enabled).length;
  const signals = g.keywords.reduce((a, k) => a + k.count, 0);
  return (
    <details style={{ borderTop: `1px solid ${ADMIN_COLORS.border}`, padding: '10px 0' }} data-group={g.key}>
      <summary style={{ cursor: 'pointer', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', listStyle: 'none' }}>
        <input
          type="checkbox"
          aria-label={`Use the group "${g.label}"`}
          checked={g.enabled}
          disabled={disabled}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => change({ action: 'group_toggle', group: g.key, enabled: e.target.checked }, `"${g.label}" switched ${e.target.checked ? 'on' : 'off'}.`)}
        />
        <strong style={{ fontSize: 14, color: g.enabled ? ADMIN_COLORS.textHeading : ADMIN_COLORS.textMuted }}>{g.label}</strong>
        <span style={adminBadge(g.enabled ? 'success' : 'neutral')}>{g.enabled ? 'On' : 'Off'}</span>
        <span style={{ fontSize: 12, color: ADMIN_COLORS.textMuted }}>
          {g.trigger ? `Suggests ${triggerLabel(g.trigger)}` : 'Each keyword suggests its own trigger'} · {on} of {g.keywords.length} keywords on · {signals} {signals === 1 ? 'signal' : 'signals'}
        </span>
      </summary>
      <ul style={{ listStyle: 'none', margin: '10px 0 0', padding: 0 }}>
        {g.keywords.map((k) => (
          <KeywordRow key={`${k.id}:${k.keyword}:${k.trigger}:${k.enabled}`} k={k} disabled={disabled} change={change} />
        ))}
      </ul>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
        <input aria-label={`New keyword for ${g.label}`} placeholder="Add a keyword" value={text} maxLength={KEYWORD_LIMITS.keyword} onChange={(e) => setText(e.target.value)} style={{ ...adminInput, flex: '1 1 220px', width: 'auto' }} />
        <TriggerSelect label="Trigger type for the new keyword" value={trigger} onChange={setTrigger} />
        <PrimaryButton
          disabled={disabled || text.trim().length < 2}
          onClick={async () => {
            if (await change({ action: 'keyword_add', group: g.key, keyword: text, trigger }, `"${text.trim()}" added.`)) setText('');
          }}
        >
          Add
        </PrimaryButton>
      </div>
    </details>
  );
}

export function KeywordLibrary({ initial }: { initial: Library }) {
  const [lib, setLib] = useState(initial);
  const [confirmReset, setConfirmReset] = useState(false);
  const { busy, notice, run } = useAction();
  const pending = lib.source === 'pending';
  const change = (body: Record<string, unknown>, done: string) =>
    run(
      'keywords',
      async () => {
        const res = await sendJson<{ library: Library }>('PATCH', '/api/admin/growth/keywords', body);
        setLib(res.library);
        return done;
      },
      { refresh: false },
    );
  const all = lib.groups.flatMap((g) => g.keywords);
  const active = lib.groups.filter((g) => g.enabled).flatMap((g) => g.keywords.filter((k) => k.enabled)).length;
  return (
    <section style={{ ...adminCard, marginBottom: 16 }} aria-labelledby="keyword-library" id="keywords">
      <h2 id="keyword-library" style={{ margin: 0, fontSize: 15, fontWeight: 700, color: ADMIN_COLORS.textHeading }}>
        Signal keywords
      </h2>
      <p style={{ margin: '4px 0 10px', fontSize: 12, color: ADMIN_COLORS.textMuted }}>
        Grouped by trigger type. The feed searches the keywords that are on, in groups that are on; a match suggests the signal&apos;s trigger, which you can change in the inbox. Counts are real signals found by each keyword.
      </p>
      <p style={{ margin: '0 0 10px', fontSize: 13 }} data-active={active}>
        {active} of {all.length} keywords in use.
        {lib.source === 'defaults' && ' Showing the defaults: your first change saves them.'}
      </p>
      {pending && <p style={{ margin: '0 0 10px', fontSize: 13, color: ADMIN_COLORS.warning }}>Needs 094_growth_signal_keywords.sql applied before the library can be changed. Shown with its defaults.</p>}
      {lib.error && <p style={{ margin: '0 0 10px', fontSize: 13, color: ADMIN_COLORS.danger }}>Could not read the library: {lib.error}</p>}
      <div>
        {lib.groups.map((g) => (
          <Group key={g.key} g={g} disabled={pending || busy !== null} change={change} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
        {confirmReset ? (
          <>
            <span style={{ fontSize: 13 }}>Restore every default keyword and group setting, and remove the keywords you added?</span>
            <GhostButton danger disabled={pending || busy !== null} onClick={async () => (await change({ action: 'reset' }, 'Keywords reset to the defaults.'), setConfirmReset(false))}>
              Confirm reset
            </GhostButton>
            <GhostButton onClick={() => setConfirmReset(false)}>Cancel</GhostButton>
          </>
        ) : (
          <GhostButton disabled={pending || busy !== null} onClick={() => setConfirmReset(true)}>
            Reset to defaults
          </GhostButton>
        )}
      </div>
      <NoticeLine notice={notice} />
    </section>
  );
}
