'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';

export type DropdownItem = { label: string; href: string; meta?: string };

/**
 * A nav item that both links somewhere itself and opens a panel of children.
 *
 * The parent has to stay a real link: Services is a page in its own right, and
 * turning it into a button that only opens a menu would take a destination out
 * of the navigation to add a menu. So the anchor keeps its href and a separate,
 * adjacent button owns the panel. That also settles the pointer and keyboard
 * question cleanly: clicking the word goes to /services, clicking the chevron
 * (or pressing Down, Enter or Space on it) opens the list.
 *
 * Hover opens it too, since that is what a visitor expects of a nav menu, but
 * hover alone is never the only way in.
 *
 * Closes on Escape, on a click outside, and on focus leaving the group. Escape
 * returns focus to the toggle rather than dropping it to the top of the
 * document, which is what makes the menu usable without a mouse.
 *
 * Desktop only. Below the navbar breakpoint the parent renders as an ordinary
 * link and its children are listed underneath it inside the existing mobile
 * menu, which is a stacked list and has no room for a floating panel.
 */
export function NavDropdown({
  label,
  href,
  items,
  active,
  columns = 2,
}: {
  label: string;
  href: string;
  items: DropdownItem[];
  active: boolean;
  columns?: 1 | 2;
}) {
  const [open, setOpen] = useState(false);
  const groupRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  // A short close delay on pointer leave, so travelling from the trigger to the
  // panel across the few pixels between them does not shut it.
  const closeTimer = useRef<number | null>(null);
  const cancelClose = () => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setOpen(false), 140);
  };

  useEffect(() => cancelClose, []);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      toggleRef.current?.focus();
    };
    // `pointerdown` rather than `click`: closing on the way down means the
    // menu is gone before the click lands, so a click on the page behind it
    // does what the visitor meant rather than only dismissing the panel.
    const onPointerDown = (e: PointerEvent) => {
      if (!groupRef.current?.contains(e.target as Node)) setOpen(false);
    };

    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  return (
    <div
      ref={groupRef}
      className="relative"
      data-nav-dropdown={label}
      onMouseEnter={() => {
        cancelClose();
        setOpen(true);
      }}
      onMouseLeave={scheduleClose}
      onBlurCapture={(e) => {
        // Tabbing past the last item closes the panel. Checking relatedTarget
        // rather than using a timer keeps it exact.
        if (!groupRef.current?.contains(e.relatedTarget as Node | null)) {
          setOpen(false);
        }
      }}
    >
      <span className="flex items-center gap-1">
        <Link
          href={href}
          data-active={active ? 'true' : undefined}
          className={
            'pmbc-link-underline text-[13px] font-medium uppercase transition-colors duration-200 ' +
            (active
              ? 'text-[color:var(--pmbc-primary)]'
              : 'text-[color:var(--pmbc-text)] hover:text-[color:var(--pmbc-primary)]')
          }
          style={{ letterSpacing: '0.08em' }}
        >
          {label}
        </Link>
        <button
          ref={toggleRef}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={`${label} menu`}
          onClick={() => setOpen((v) => !v)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setOpen(true);
              // Hand focus to the first item, so Down then Down walks the list.
              window.requestAnimationFrame(() => {
                groupRef.current
                  ?.querySelector<HTMLAnchorElement>('[data-dropdown-item]')
                  ?.focus();
              });
            }
          }}
          className="inline-flex h-6 w-5 items-center justify-center text-[color:var(--pmbc-muted)] transition-colors duration-200 hover:text-[color:var(--pmbc-primary)]"
        >
          <ChevronDown
            size={14}
            strokeWidth={2}
            className="transition-transform duration-200"
            style={{ transform: open ? 'rotate(180deg)' : undefined }}
          />
        </button>
      </span>

      {open && (
        <div
          id={panelId}
          data-dropdown-panel=""
          className="absolute left-0 top-full z-50 hidden pt-3 md:block"
        >
          <div
            className={
              'grid gap-x-8 gap-y-1 p-5 ' + (columns === 2 ? 'grid-cols-2' : 'grid-cols-1')
            }
            style={{
              minWidth: columns === 2 ? 520 : 260,
              background: '#FFFFFF',
              border: '1px solid rgba(198, 156, 62, 0.28)',
              boxShadow: '0 18px 48px rgba(15, 37, 64, 0.12)',
            }}
          >
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                data-dropdown-item=""
                className="group flex items-baseline gap-3 px-3 py-2.5 transition-colors duration-200 hover:bg-[color:var(--pmbc-surface-cream)]"
              >
                {item.meta && (
                  <span
                    className="font-serif text-[13px] font-semibold"
                    style={{ color: '#A88530' }}
                  >
                    {item.meta}
                  </span>
                )}
                <span
                  className="text-[14px] leading-snug text-[color:var(--pmbc-text)] transition-colors duration-200 group-hover:text-[color:var(--pmbc-primary)]"
                >
                  {item.label}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
