'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import {
  ArrowUpRight,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileCode2,
  FileText,
  FolderKanban,
  History,
  Image as ImageIcon,
  Inbox,
  LayoutDashboard,
  LayoutTemplate,
  LogOut,
  Mail,
  Menu,
  MessageSquareQuote,
  Newspaper,
  Palette,
  PanelTop,
  Settings,
  Type,
  Users,
  X,
} from 'lucide-react';
import { signOut } from 'next-auth/react';

type NavItem = {
  kind: 'item';
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  matchExact?: boolean;
  matchPaths?: string[];
};

type NavDivider = { kind: 'divider'; label?: string };

type NavEntry = NavItem | NavDivider;

const NAV: NavEntry[] = [
  { kind: 'item', label: 'Dashboard', href: '/admin', icon: LayoutDashboard, matchExact: true },
  { kind: 'divider', label: 'Leads' },
  {
    kind: 'item',
    label: 'Inquiries',
    href: '/admin/contact-submissions',
    icon: Inbox,
  },
  { kind: 'divider', label: 'Collections' },
  { kind: 'item', label: 'Services', href: '/admin/services', icon: Briefcase },
  { kind: 'item', label: 'Case Studies', href: '/admin/case-studies', icon: FolderKanban },
  { kind: 'item', label: 'Team & Advisors', href: '/admin/team', icon: Users },
  { kind: 'item', label: 'Insights', href: '/admin/articles', icon: Newspaper },
  { kind: 'item', label: 'Testimonials', href: '/admin/testimonials', icon: MessageSquareQuote },
  { kind: 'divider', label: 'Content' },
  { kind: 'item', label: 'Page Builder', href: '/admin/page-builder', icon: LayoutTemplate },
  {
    kind: 'item',
    label: 'Pages & Nav',
    href: '/admin/pages',
    icon: FileText,
    matchPaths: ['/admin/page-builder'],
  },
  { kind: 'item', label: 'Page Content', href: '/admin/content', icon: Type },
  {
    kind: 'item',
    label: 'Header & Branding',
    href: '/admin/branding',
    icon: Palette,
    matchPaths: ['/admin/brand'],
  },
  { kind: 'item', label: 'Header Settings', href: '/admin/header-settings', icon: PanelTop },
  { kind: 'item', label: 'Media Library', href: '/admin/media', icon: ImageIcon },
  { kind: 'item', label: 'OG Previews', href: '/admin/og-preview', icon: ImageIcon },
  { kind: 'divider', label: 'Email' },
  { kind: 'item', label: 'Email Branding', href: '/admin/email-branding', icon: Mail },
  { kind: 'item', label: 'Email Templates', href: '/admin/email-templates', icon: FileCode2 },
  { kind: 'divider', label: 'System' },
  { kind: 'item', label: 'Site Settings', href: '/admin/settings', icon: Settings },
  { kind: 'item', label: 'Audit Log', href: '/admin/audit', icon: History },
];

const EXTERNAL_LINKS: Array<{ label: string; href: string }> = [
  { label: 'View Live Site', href: 'https://www.pacemakersglobal.com' },
  { label: 'Visit FMP', href: 'https://www.financialmodelerpro.com' },
];

const COLOR = {
  bg: '#0F2540',
  bgHover: 'rgba(255,255,255,0.06)',
  bgActive: '#1B3A5F',
  divider: 'rgba(255,255,255,0.08)',
  text: 'rgba(255,255,255,0.78)',
  textActive: '#FFFFFF',
  textMuted: 'rgba(255,255,255,0.5)',
  accent: '#D4A93A',
};

const COLLAPSE_KEY = 'pmbcAdminSidebarCollapsed';
const SCROLL_KEY = 'admin_sidebar_scroll';
const MOBILE_BREAKPOINT = 768;

function isActive(pathname: string, item: NavItem): boolean {
  if (item.matchExact) return pathname === item.href;
  if (pathname === item.href) return true;
  if (pathname.startsWith(item.href + '/')) return true;
  if (item.matchPaths) {
    for (const m of item.matchPaths) {
      if (pathname === m || pathname.startsWith(m + '/')) return true;
    }
  }
  return false;
}

export function CmsAdminNav({
  adminEmail,
  adminName,
}: {
  adminEmail?: string;
  adminName?: string;
}) {
  const pathname = usePathname() ?? '';

  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Hydrate from storage + watch viewport.
  useEffect(() => {
    try {
      const v = window.localStorage.getItem(COLLAPSE_KEY);
      if (v === '1') setCollapsed(true);
    } catch {}
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    setHydrated(true);
    return () => mq.removeEventListener('change', apply);
  }, []);

  // Persist collapse.
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
    } catch {}
  }, [collapsed, hydrated]);

  // Restore scroll on pathname change; persist on scroll.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    try {
      const saved = window.sessionStorage.getItem(SCROLL_KEY);
      if (saved) el.scrollTop = parseInt(saved, 10) || 0;
    } catch {}
  }, [pathname]);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    try {
      window.sessionStorage.setItem(SCROLL_KEY, String(el.scrollTop));
    } catch {}
  }, []);

  // Close drawer on route change.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Lock body scroll while drawer open.
  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [drawerOpen]);

  const width = collapsed ? 64 : 240;
  const showLabels = !collapsed || isMobile;

  const renderEntries = (effectiveCollapsed: boolean) => (
    <>
      <ul style={{ listStyle: 'none', margin: 0, padding: '8px 0' }}>
        {NAV.map((entry, idx) => {
          if (entry.kind === 'divider') {
            if (effectiveCollapsed) {
              return (
                <li key={`d${idx}`} aria-hidden>
                  <div
                    style={{
                      height: 1,
                      background: COLOR.divider,
                      margin: '8px 12px',
                    }}
                  />
                </li>
              );
            }
            return (
              <li key={`d${idx}`} aria-hidden>
                <div
                  style={{
                    padding: '14px 18px 6px',
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: COLOR.textMuted,
                  }}
                >
                  {entry.label}
                </div>
              </li>
            );
          }
          const active = isActive(pathname, entry);
          const Icon = entry.icon;
          return (
            <li key={entry.href} style={{ padding: '0 8px' }}>
              <Link
                href={entry.href}
                title={effectiveCollapsed ? entry.label : undefined}
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: effectiveCollapsed ? '10px 0' : '9px 12px',
                  paddingLeft: effectiveCollapsed ? 0 : 14,
                  justifyContent: effectiveCollapsed ? 'center' : 'flex-start',
                  borderRadius: 6,
                  background: active ? COLOR.bgActive : 'transparent',
                  color: active ? COLOR.textActive : COLOR.text,
                  fontSize: 13,
                  fontWeight: active ? 600 : 500,
                  textDecoration: 'none',
                  transition: 'background 120ms ease, color 120ms ease',
                  borderLeft: active
                    ? `3px solid ${COLOR.accent}`
                    : '3px solid transparent',
                }}
                onMouseEnter={(e) => {
                  if (!active) e.currentTarget.style.background = COLOR.bgHover;
                }}
                onMouseLeave={(e) => {
                  if (!active) e.currentTarget.style.background = 'transparent';
                }}
              >
                <Icon
                  size={16}
                  style={{
                    flexShrink: 0,
                    color: active ? COLOR.textActive : COLOR.text,
                  }}
                />
                {!effectiveCollapsed && (
                  <span
                    style={{
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {entry.label}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>

      <div
        style={{
          marginTop: 16,
          padding: effectiveCollapsed ? '12px 8px' : '12px 16px',
          borderTop: `1px solid ${COLOR.divider}`,
        }}
      >
        {!effectiveCollapsed && (
          <p
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: COLOR.textMuted,
              margin: '6px 0 8px',
            }}
          >
            External
          </p>
        )}
        {EXTERNAL_LINKS.map((l) => (
          <a
            key={l.href}
            href={l.href}
            target="_blank"
            rel="noopener noreferrer"
            title={effectiveCollapsed ? l.label : undefined}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: effectiveCollapsed ? '8px 0' : '8px 6px',
              justifyContent: effectiveCollapsed ? 'center' : 'flex-start',
              fontSize: 12,
              color: COLOR.text,
              textDecoration: 'none',
              borderRadius: 6,
              transition: 'background 120ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = COLOR.bgHover;
              e.currentTarget.style.color = COLOR.textActive;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = COLOR.text;
            }}
          >
            <ExternalLink size={13} style={{ flexShrink: 0 }} />
            {!effectiveCollapsed && <span>{l.label}</span>}
          </a>
        ))}
      </div>
    </>
  );

  // ----- Mobile drawer -----
  if (isMobile) {
    return (
      <>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open admin navigation"
          style={mobileToggleStyle}
        >
          <Menu size={20} />
        </button>

        {drawerOpen && (
          <div
            role="dialog"
            aria-modal="true"
            style={{ position: 'fixed', inset: 0, zIndex: 60 }}
          >
            <div
              onClick={() => setDrawerOpen(false)}
              style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(15,37,64,0.5)',
              }}
            />
            <aside
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: 0,
                width: 280,
                background: COLOR.bg,
                color: COLOR.textActive,
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 12px 48px rgba(0,0,0,0.4)',
              }}
            >
              <DrawerHeader
                onClose={() => setDrawerOpen(false)}
                adminName={adminName}
                adminEmail={adminEmail}
              />
              <div
                ref={scrollRef}
                onScroll={onScroll}
                style={{ flex: 1, overflowY: 'auto' }}
              >
                {renderEntries(false)}
              </div>
              <SignOutFooter collapsed={false} />
            </aside>
          </div>
        )}
      </>
    );
  }

  // ----- Desktop sidebar -----
  return (
    <aside
      aria-label="Admin navigation"
      style={{
        width,
        minWidth: width,
        height: '100vh',
        position: 'sticky',
        top: 0,
        background: COLOR.bg,
        color: COLOR.textActive,
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 160ms ease, min-width 160ms ease',
      }}
    >
      <div
        style={{
          padding: collapsed ? '14px 8px' : '16px 18px',
          borderBottom: `1px solid ${COLOR.divider}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          gap: 8,
        }}
      >
        {!collapsed ? (
          <div style={{ minWidth: 0 }}>
            <p
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: COLOR.textMuted,
                margin: 0,
              }}
            >
              PaceMakers
            </p>
            <p
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: COLOR.textActive,
                margin: '2px 0 0',
              }}
            >
              Admin Console
            </p>
          </div>
        ) : (
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.14em',
              color: COLOR.textActive,
            }}
          >
            PMBC
          </span>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={collapseBtnStyle}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      <div
        ref={scrollRef}
        onScroll={onScroll}
        style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}
      >
        {renderEntries(collapsed)}
      </div>

      <SignOutFooter collapsed={collapsed} />
    </aside>
  );
}

function DrawerHeader({
  onClose,
  adminName,
  adminEmail,
}: {
  onClose: () => void;
  adminName?: string;
  adminEmail?: string;
}) {
  return (
    <div
      style={{
        padding: '14px 16px',
        borderBottom: `1px solid ${COLOR.divider}`,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <p
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: COLOR.textMuted,
            margin: 0,
          }}
        >
          PaceMakers Admin
        </p>
        {adminName && (
          <p
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: COLOR.textActive,
              margin: '2px 0 0',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {adminName}
          </p>
        )}
        {adminEmail && (
          <p
            style={{
              fontSize: 11,
              color: COLOR.textMuted,
              margin: '1px 0 0',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {adminEmail}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close navigation"
        style={collapseBtnStyle}
      >
        <X size={14} />
      </button>
    </div>
  );
}

function SignOutFooter({ collapsed }: { collapsed: boolean }) {
  return (
    <div
      style={{
        borderTop: `1px solid ${COLOR.divider}`,
        padding: collapsed ? '10px 8px' : '12px 16px',
      }}
    >
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: '/admin/login' })}
        title={collapsed ? 'Sign out' : undefined}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          width: '100%',
          padding: collapsed ? '8px 0' : '8px 10px',
          justifyContent: collapsed ? 'center' : 'flex-start',
          background: 'transparent',
          color: COLOR.text,
          border: 'none',
          borderRadius: 6,
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 500,
          transition: 'background 120ms ease, color 120ms ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = COLOR.bgHover;
          e.currentTarget.style.color = COLOR.textActive;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = COLOR.text;
        }}
      >
        <LogOut size={14} style={{ flexShrink: 0 }} />
        {!collapsed && <span>Sign out</span>}
      </button>
    </div>
  );
}

const collapseBtnStyle: CSSProperties = {
  width: 28,
  height: 28,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 6,
  background: 'rgba(255,255,255,0.06)',
  color: COLOR.textActive,
  border: 'none',
  cursor: 'pointer',
};

const mobileToggleStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 36,
  height: 36,
  background: '#FFFFFF',
  color: '#0F2540',
  border: '1px solid #E5E7EB',
  borderRadius: 8,
  cursor: 'pointer',
};

// Re-export legacy props on a small badge component if any future call sites
// need to render an external link button inline.
export function ExternalLinkButton({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 12,
        color: '#1B3A5F',
        textDecoration: 'none',
      }}
    >
      {label}
      <ArrowUpRight size={12} />
    </a>
  );
}
