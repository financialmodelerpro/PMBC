'use client';

/**
 * A searchable select on the ARIA combobox pattern: type to filter, arrow keys
 * to move, Enter to choose, Escape to close. Each option can carry a short tag,
 * used for the currency code beside each country.
 *
 * Keyboard contract:
 *   ArrowDown / ArrowUp  open the list, or move the highlight
 *   Enter                choose the highlighted option
 *   Escape               close without changing the value
 *   Tab                  close and move on
 */

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

import { inputClass } from './ui';

export type SearchOption = { value: string; label: string; tag?: string };

export function SearchSelect({
  id,
  value,
  options,
  placeholder,
  onChange,
  describedBy,
  invalid,
}: {
  id: string;
  value: string;
  options: SearchOption[];
  placeholder: string;
  onChange: (value: string) => void;
  describedBy?: string;
  invalid?: boolean;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);

  const selected = options.find((o) => o.value === value) ?? null;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q) || (o.tag ?? '').toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const choose = (o: SearchOption) => {
    onChange(o.value);
    setQuery('');
    setOpen(false);
  };

  return (
    <div ref={root} className="relative">
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && filtered[active] ? `${listId}-${active}` : undefined}
        aria-describedby={describedBy}
        aria-invalid={invalid}
        autoComplete="off"
        placeholder={selected ? `${selected.label}${selected.tag ? ` (${selected.tag})` : ''}` : placeholder}
        value={open ? query : selected ? `${selected.label}${selected.tag ? `  ${selected.tag}` : ''}` : ''}
        onFocus={() => {
          setOpen(true);
          setQuery('');
          setActive(Math.max(0, options.findIndex((o) => o.value === value)));
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
            setActive((a) => Math.min(filtered.length - 1, a + 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => Math.max(0, a - 1));
          } else if (e.key === 'Enter') {
            if (open && filtered[active]) {
              e.preventDefault();
              choose(filtered[active]);
            }
          } else if (e.key === 'Escape') {
            setOpen(false);
            setQuery('');
          } else if (e.key === 'Tab') {
            setOpen(false);
          }
        }}
        className={`${inputClass} pr-9`}
      />
      <ChevronDown aria-hidden size={16} className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[color:var(--pmbc-muted)]" />
      {open && (
        <ul
          ref={list}
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-[2px] border border-[color:var(--pmbc-border-warm)] bg-white py-1 shadow-[0_12px_32px_rgba(20,48,79,0.14)]"
        >
          {filtered.length === 0 && <li className="px-3 py-2 text-[14px] text-[color:var(--pmbc-muted)]">No match</li>}
          {filtered.map((o, i) => (
            <li
              key={o.value}
              id={`${listId}-${i}`}
              data-index={i}
              role="option"
              aria-selected={o.value === value}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(o);
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-[14px] ${
                i === active ? 'bg-[#F6F1E6] text-[color:var(--pmbc-text)]' : 'text-[color:var(--pmbc-text)]'
              }`}
            >
              <span className="flex items-center gap-2">
                <Check aria-hidden size={14} className={o.value === value ? 'text-[#A88530]' : 'opacity-0'} />
                {o.label}
              </span>
              {o.tag && (
                <span className="rounded-[2px] bg-[#1B3A5F] px-1.5 py-0.5 text-[11px] font-semibold tracking-[0.06em] text-white">{o.tag}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
