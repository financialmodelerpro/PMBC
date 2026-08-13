'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

import {
  OTHER_COUNTRIES,
  PINNED_COUNTRIES,
  findCountry,
  type Country,
} from '@/lib/public/countries';

/**
 * A searchable country picker for the phone field.
 *
 * It replaces a native `<select>` of 206 options whose text was the ISO code and
 * the dial code only. That list was alphabetical by country name, but the name
 * was the one thing it did not show, so it read as "AF +93, AL +355, DZ +213,
 * AD +376", which looks like no order at all. Two fixes, and the first is the
 * one that matters: the name is now on every row, so the order explains itself.
 * The second is that a list of 206 needs a way in other than scrolling.
 *
 * Matching is deliberately loose, because a person reaching for this control
 * knows one of three things and should not have to guess which one it wants:
 * the country name, the dial code, or the two-letter code. Any of them filters.
 *
 * Built on the ARIA combobox pattern rather than a styled `<select>`, since a
 * native select cannot filter. That means the keyboard contract has to be
 * implemented rather than inherited, so it is written out explicitly below and
 * asserted in the verification.
 */

type Group = { label: string; items: Country[] };

function label(c: Country): string {
  return `${c.name} (+${c.dial})`;
}

/** Name, dial code with or without the plus, or ISO code. */
function matches(c: Country, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const bare = q.replace(/^\+/, '');
  return (
    c.name.toLowerCase().includes(q) ||
    c.code.toLowerCase() === q ||
    (bare.length > 0 && /^\d+$/.test(bare) && c.dial.startsWith(bare))
  );
}

export function CountryCombobox({
  value,
  onChange,
  id,
  ariaLabel,
}: {
  /** ISO code of the selected country. */
  value: string;
  onChange: (code: string) => void;
  id?: string;
  ariaLabel: string;
}) {
  const reactId = useId();
  const baseId = id ?? `country-${reactId}`;
  const listboxId = `${baseId}-listbox`;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = findCountry(value);

  const groups: Group[] = useMemo(() => {
    const pinned = PINNED_COUNTRIES.filter((c) => matches(c, query));
    const rest = OTHER_COUNTRIES.filter((c) => matches(c, query));
    // The pinned seven stay grouped and labelled while filtering. Dropping the
    // grouping as soon as someone types would move a row mid-search, which is
    // the one thing a filtered list must not do.
    return [
      ...(pinned.length ? [{ label: 'Frequently selected', items: pinned }] : []),
      ...(rest.length ? [{ label: 'All countries', items: rest }] : []),
    ];
  }, [query]);

  /** Flat order, which is what the arrow keys walk. */
  const flat: Country[] = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  // Keep the active row inside the list. A filter that empties the list, or one
  // that shortens it below the current index, would otherwise leave
  // aria-activedescendant pointing at an element that no longer exists.
  useEffect(() => {
    setActiveIndex((i) => (flat.length === 0 ? 0 : Math.min(i, flat.length - 1)));
  }, [flat.length]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Scroll the active option into view without moving the page.
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    el?.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex]);

  function openList(startAt = 0) {
    setOpen(true);
    setActiveIndex(startAt);
  }

  /** Closes, and clears the query so the input shows the selection again. */
  function close(keepFocus: boolean) {
    setOpen(false);
    setQuery('');
    if (keepFocus) inputRef.current?.focus();
  }

  function commit(c: Country | undefined) {
    if (!c) return;
    onChange(c.code);
    close(true);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!open) openList(0);
        else setActiveIndex((i) => (flat.length ? (i + 1) % flat.length : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (!open) openList(Math.max(0, flat.length - 1));
        else setActiveIndex((i) => (flat.length ? (i - 1 + flat.length) % flat.length : 0));
        break;
      case 'Home':
        if (open) {
          e.preventDefault();
          setActiveIndex(0);
        }
        break;
      case 'End':
        if (open) {
          e.preventDefault();
          setActiveIndex(Math.max(0, flat.length - 1));
        }
        break;
      case 'Enter':
        // Only swallowed while the list is open. Otherwise Enter in a form
        // field must still submit the form, which is what people expect.
        if (open) {
          e.preventDefault();
          commit(flat[activeIndex]);
        }
        break;
      case 'Escape':
        if (open) {
          e.preventDefault();
          close(true);
        }
        break;
      case 'Tab':
        // Leaves the selection as it was. Committing whatever happened to be
        // highlighted on the way past would change a value the visitor never
        // chose.
        if (open) close(false);
        break;
      default:
        break;
    }
  }

  const activeId = open && flat.length > 0 ? `${baseId}-opt-${activeIndex}` : undefined;

  return (
    <div ref={rootRef} className="relative" data-country-combobox={ariaLabel}>
      <div className="relative">
        <input
          ref={inputRef}
          id={baseId}
          type="text"
          role="combobox"
          aria-label={ariaLabel}
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          autoComplete="off"
          spellCheck={false}
          // While closed the field shows the selection. While open it is a
          // search box, with the selection demoted to the placeholder so the
          // visitor can type straight away instead of clearing text first.
          value={open ? query : selected ? label(selected) : ''}
          placeholder={open ? (selected ? label(selected) : 'Search countries') : 'Select a country'}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
            setActiveIndex(0);
          }}
          onKeyDown={onKeyDown}
          onMouseDown={() => {
            if (!open) openList(Math.max(0, flat.findIndex((c) => c.code === value)));
          }}
          className={`${inputCls} pr-9`}
        />
        <ChevronDown
          size={15}
          aria-hidden
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--pmbc-muted)] transition-transform duration-200"
          style={{ transform: open ? 'translateY(-50%) rotate(180deg)' : undefined }}
        />
      </div>

      {/* Result count, for a screen reader that cannot see the list shrink. */}
      <span aria-live="polite" className="sr-only">
        {open ? `${flat.length} ${flat.length === 1 ? 'country' : 'countries'} available` : ''}
      </span>

      {open && (
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-label={ariaLabel}
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-[280px] overflow-y-auto rounded-md py-1"
          style={{
            background: '#FFFFFF',
            border: '1px solid var(--pmbc-border)',
            boxShadow: '0 18px 48px rgba(15, 37, 64, 0.14)',
          }}
        >
          {flat.length === 0 && (
            <li className="px-3 py-3 text-[13.5px] text-[color:var(--pmbc-muted)]">
              No country matches that.
            </li>
          )}

          {groups.map((group) => (
            <li key={group.label} role="presentation">
              <p
                className="px-3 pb-1 pt-2 text-[10.5px] font-semibold uppercase"
                style={{ letterSpacing: '0.14em', color: '#A88530' }}
                id={`${baseId}-grp-${group.label.replace(/\s+/g, '-')}`}
              >
                {group.label}
              </p>
              <ul
                role="group"
                aria-labelledby={`${baseId}-grp-${group.label.replace(/\s+/g, '-')}`}
              >
                {group.items.map((c) => {
                  const index = flat.indexOf(c);
                  const isActive = index === activeIndex;
                  const isSelected = c.code === value;
                  return (
                    <li
                      key={`${group.label}-${c.code}`}
                      id={`${baseId}-opt-${index}`}
                      role="option"
                      aria-selected={isSelected}
                      data-active={isActive ? 'true' : undefined}
                      // `pointerdown` rather than `click`: the input would
                      // otherwise blur first and close the list before the
                      // click landed.
                      onPointerDown={(e) => {
                        e.preventDefault();
                        commit(c);
                      }}
                      onMouseEnter={() => setActiveIndex(index)}
                      className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-[14px]"
                      style={{
                        background: isActive ? 'var(--pmbc-surface-cream)' : 'transparent',
                        color: 'var(--pmbc-text)',
                      }}
                    >
                      <span className="flex items-center gap-2">
                        {isSelected && (
                          <Check size={13} aria-hidden style={{ color: '#A88530' }} />
                        )}
                        <span className={isSelected ? 'font-semibold' : undefined}>{c.name}</span>
                      </span>
                      <span
                        className="shrink-0 text-[13px] tabular-nums"
                        style={{ color: 'var(--pmbc-muted)' }}
                      >
                        +{c.dial}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Matches the form's other controls. Kept local so the two cannot drift apart. */
const inputCls =
  'block w-full rounded-md border border-[color:var(--pmbc-border)] bg-white px-3.5 py-2.5 text-[14px] text-[color:var(--pmbc-text)] placeholder:text-[color:var(--pmbc-muted)]/70 outline-none transition focus:border-[color:var(--pmbc-primary)] focus:ring-2 focus:ring-[color:var(--pmbc-primary)]/15';
