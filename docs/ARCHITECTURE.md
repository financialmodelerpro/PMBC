# Architecture and admin reference

Moved verbatim from `CLAUDE.md` on 2026-09-22 (original kept at `docs/archive/CLAUDE.md.bak-2026-09-22`). Contradictions found in the split were resolved to the current behaviour; each such line is noted in `docs/HISTORY.md` under 2026-09-22.

**Read this before:** changing the stack, the folder layout, admin roles or routes, the admin sidebar, or the page builder.

## 2. Architecture Overview

Single Next.js application, single domain (pacemakersglobal.com), no subdomain routing. Public marketing site plus admin CMS. No student auth, no public registration, no payment flows, no third-party integrations beyond Brevo and Supabase.

### Stack

| Layer | Technology | Version | Notes |
|-------|------------|---------|-------|
| Framework | Next.js (App Router) | ^15 | Latest stable. Match FMP's discipline but no need for v16 features. |
| Language | TypeScript strict | ^5 | strict mode on |
| Styling | Tailwind CSS 4 | ^4 | Same as FMP |
| State | Zustand | ^5 | Only if needed; most pages are server components |
| Database | Supabase (@supabase/supabase-js) | ^2 | New project, separate from FMP |
| Auth | NextAuth.js (JWT, admin-only) | ^4 | Single admin role, no public users |
| Email | Brevo v3 REST API | no SDK | Contact form notifications. Plain `fetch`, see section 7. |
| Image | sharp | ^0.34 | OG image logo conversion |
| OG Images | next/og (satori ImageResponse) | built-in | Dynamic OG cards |
| Icons | lucide-react | ^1 | Lucide moved to a 1.x major in 2024. v1.x is current and correct : do **not** "downgrade" to 0.x. |
| Forms | react-hook-form + zod | latest | Contact form validation |
| Rich Text | @tiptap/react | latest | Admin content editing |
| Captcha | @hcaptcha/react-hcaptcha | ^2 | Dormant since 2026-08-16: the contact and testimonial forms use a honeypot and a timing floor. Setting both hCaptcha keys turns it back on |
| Passwords | bcryptjs | ^3 | Admin password hashing |
| PDF | @react-pdf/renderer | ^4 | Free tool PDF reports, rendered on the server. Kept out of the bundle via `serverExternalPackages`; fonts traced in with `outputFileTracingIncludes`. See "Free Tools". |

### Explicitly NOT Used in v1

The following are in FMP but NOT in PMBC v1. Do not install them. They add maintenance burden without value for a credibility site.

| Excluded | Reason |
|----------|--------|
| Google Apps Script | No external roster system |
| pdf-lib | No certificate generation. **`@react-pdf/renderer` was on this line and was lifted on 2026-09-16** for the free tools' PDF reports; one PDF library is enough, so pdf-lib stays excluded. |
| exceljs | No spreadsheet export |
| Recharts | No data visualizations |
| @anthropic-ai/sdk | No AI features in v1 |
| YouTube API | No video integration |
| @auth/supabase-adapter for student auth | Admin-only auth |
| Stripe or any payment SDK | No commerce |
| Cron jobs | Nothing to run on schedule. **Exception since 2026-09-21:** one Vercel cron (`vercel.json`) for the free tools' reminders, see section 7b. |

### Folder Structure

```
src/
├── app/
│   ├── (public)/
│   │   ├── page.tsx                    # Home
│   │   ├── services/page.tsx           # Services overview
│   │   ├── services/[slug]/page.tsx    # Individual service detail
│   │   ├── sectors/page.tsx            # Sector coverage
│   │   ├── approach/page.tsx           # Engagement methodology
│   │   ├── network/page.tsx            # Sky Gulf, Lynkers
│   │   ├── about/page.tsx              # Firm and founder
│   │   ├── contact/page.tsx            # Contact form
│   │   ├── financial-modeler-pro/page.tsx   # FMP introduction page
│   │   ├── privacy/page.tsx            # Privacy policy
│   │   └── terms/page.tsx              # Terms of engagement
│   ├── admin/
│   │   ├── login/page.tsx
│   │   ├── page.tsx                    # Dashboard
│   │   ├── page-builder/page.tsx       # List all CMS pages (Builder button per row)
│   │   ├── page-builder/[slug]/page.tsx
│   │   ├── pages/page.tsx              # Pages & Nav: navbar menu items (site_pages)
│   │   ├── leads/page.tsx              # Redirect alias to contact-submissions
│   │   ├── content/page.tsx            # Key-value CMS editor
│   │   ├── branding/page.tsx           # Logo, colors, footer
│   │   ├── header-settings/page.tsx
│   │   ├── contact-submissions/page.tsx
│   │   ├── email-branding/page.tsx
│   │   ├── email-templates/page.tsx
│   │   └── settings/page.tsx
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts
│   │   ├── contact/route.ts
│   │   ├── og/route.tsx
│   │   ├── admin/
│   │   │   ├── pages/route.ts
│   │   │   ├── page-sections/route.ts
│   │   │   ├── content/route.ts
│   │   │   ├── branding/route.ts
│   │   │   ├── contact-submissions/route.ts
│   │   │   └── ...
│   ├── layout.tsx                      # Root layout
│   ├── globals.css
│   └── not-found.tsx
├── components/
│   ├── layout/
│   │   ├── Navbar.tsx
│   │   ├── NavbarServer.tsx
│   │   ├── Footer.tsx
│   │   └── FooterServer.tsx
│   ├── public/
│   │   ├── Hero.tsx
│   │   ├── StatsBlock.tsx
│   │   ├── ServiceCards.tsx
│   │   ├── SectorGrid.tsx
│   │   ├── ProcessSteps.tsx
│   │   ├── NetworkPartners.tsx
│   │   ├── FounderBlock.tsx
│   │   ├── TextImage.tsx
│   │   ├── ContactForm.tsx
│   │   └── ...
│   ├── admin/
│   │   ├── PageBuilder.tsx
│   │   ├── SectionEditor.tsx
│   │   ├── editors/
│   │   │   ├── HeroEditor.tsx
│   │   │   ├── StatsEditor.tsx
│   │   │   ├── ServiceCardsEditor.tsx
│   │   │   ├── SectorGridEditor.tsx
│   │   │   ├── ProcessStepsEditor.tsx
│   │   │   ├── NetworkPartnersEditor.tsx
│   │   │   ├── FounderEditor.tsx
│   │   │   ├── TextImageEditor.tsx
│   │   │   └── ParagraphsEditor.tsx
│   │   ├── ContactSubmissionsTable.tsx
│   │   └── ...
│   └── ui/                             # Shared primitives
├── lib/
│   ├── supabase/
│   │   ├── server.ts                   # Server client factory
│   │   └── client.ts                   # Browser client (rare use)
│   ├── auth/
│   │   ├── config.ts                   # NextAuth config
│   │   └── middleware.ts               # Admin route protection
│   ├── cms/
│   │   ├── content.ts                  # cms_content fetchers
│   │   ├── pages.ts                    # page_sections fetchers
│   │   └── branding.ts                 # branding_config fetcher
│   ├── email/
│   │   ├── send.ts                     # Brevo wrapper
│   │   ├── templates/
│   │   │   ├── _base.ts                # baseLayoutBranded()
│   │   │   ├── contactNotification.ts
│   │   │   └── contactAcknowledgement.ts
│   │   └── branding.ts
│   ├── og/
│   │   └── logo.ts                     # SVG to PNG via sharp
│   └── utils/
│       ├── slugify.ts
│       ├── format.ts
│       └── seo.ts
├── config/
│   ├── site.ts                         # Static config (URLs, defaults)
│   ├── navigation.ts                   # Default nav items
│   └── services.ts                     # Service definitions (slug, title, summary)
├── types/
│   ├── cms.ts
│   ├── pages.ts
│   ├── auth.ts
│   └── database.ts                     # Generated Supabase types
└── middleware.ts                       # Admin route protection
```

---

## 6. Admin Panel

### Roles

Two, in `admin_users.role`, which is plain TEXT with no CHECK, so adding the
second needed no DDL.

| | `admin` | `editor` |
|---|---|---|
| Create and edit content | yes | yes |
| Hide anything | yes | yes |
| **Delete anything** | yes | **no** |
| Site Settings, Header Settings, Footer Links | yes | no |
| Users, Audit Log | yes | no |
| Pages and Nav, Page Builder, collections, media, email | yes | yes |
| Change their own password | yes | yes |

**The line is deletion, not editing.** An editor can change any page and hide any
part of it, which reaches the same end as deleting without the part that cannot
be undone.

**Enforced in three places, and only the third one counts.** The middleware
redirects an editor away from an admin-only URL, the admin layout repeats that
check server side in case the matcher changes, and every route checks for
itself. `ADMIN_ONLY_PREFIXES` in `src/lib/auth/adminAccess.ts` is the one list
the first two read. On the API side: `getAdminSession` means **any** signed-in
staff member, which is the trap to watch, since a route that should be admin-only
and calls it is open to editors and will pass any test that only signs in as an
admin. `requireOwner` is the admin-only gate and returns a 403 rather than a 401,
because an editor is signed in perfectly well and telling them to log in again is
wrong advice. `canDelete` gates the delete paths.

The UI hides what a role cannot use, through `AdminRoleProvider`. That is a
courtesy so nobody is offered an action that would fail, not a control.

### Auth

NextAuth credentials provider, JWT sessions of one hour (`SESSION_MAX_AGE_SECONDS` in `src/lib/auth/config.ts`). Login at `/admin/login`. `src/middleware.ts` matches `/admin/:path*`, lets `/admin/login` through, redirects anyone whose token role is neither `admin` nor `editor` to the login with a `callbackUrl`, and sends an editor who opens an admin-only path (`isAdminOnlyPath`, from `ADMIN_ONLY_PREFIXES` in `src/lib/auth/adminAccess.ts`) to `/admin?denied=1`. The API routes enforce the role themselves; see Roles. (Replaced on 2026-09-22 a snippet that allowed `role=admin` only.)

### Admin Pages

| Route | Purpose |
|-------|---------|
| `/admin` | Dashboard: recent contact submissions, page count, last updated timestamps |
| `/admin/page-builder` | Pages list, with a Builder button per row, a **New Page** modal (five templates) and per-row delete for non-system pages |
| `/admin/page-builder/[slug]` | Three-pane section editor. **Per-section Save** since parity 3, plus a StyleEditor per section since parity 5 |
| `/admin/pages` | Pages & Nav: the navigation menu that drives the public navbar (`site_pages` rows). Nav links only, not page content. **Inline-edit table** since parity 8: label and href pend until that row's Save; visibility, pinning and reorder save immediately |
| `/admin/footer-links` | Footer Links: the footer's counterpart to Pages & Nav, over the `(footer_settings, links)` JSON array. Same save model, plus a Column select (Firm or Contact). Added 2026-08-13 |
| `/admin/testimonials` | Testimonials, and everything that feeds it. A **Collecting testimonials** panel at the top carries the site-wide switch for whether the submission form is public (admin only, since it is a site setting) and the private-link list, which had its own sidebar entry until 2026-08-16. Below it the moderation queue: status filter tabs, per-row Approve and Reject, Revoke and Reconsider, inline Featured and Show-on-homepage switches, checkbox bulk actions. Drawer editor for the wording |
| `/admin/content` | Key-value editor for cms_content (grouped by section) |
| `/admin/branding` | **Redirect to `/admin/header-settings`** since parity 1. Kept for older bookmarks |
| `/admin/header-settings` | Brand colours, logo, branding text, header icon, header layout, CTA and mobile. Seven cards, one Save All. Owns the 17 `header_settings` keys plus the `branding_config` row. **Header background** lives in the Header layout card: white, cream or deep navy, the same three surfaces the page builder offers a section. Everything that follows from it (link colours, the CTA treatment, the monogram, the mobile panel, and whether the light logo is used) is resolved in `src/lib/public/headerSurface.ts`, which is why it is an enum rather than a hex field |
| `/admin/contact-submissions` | List and view contact form submissions, change status, add notes |
| `/admin/email-branding` | Email logo, signature, footer. Previews are sanitised through `sanitizeEmailHtml` |
| `/admin/email-templates` | Edit email subject and body for the two templates |
| `/admin/audit` | Audit log viewer: filters (admin, action, date range), 100-row paging, before/after JSON diff |
| `/admin/settings` | Misc site settings (analytics IDs, social URLs, etc.) |
| `/admin/tools` | Free tools: Live or Hidden per tool (admin only to switch), lead counts, visibility history. See section 7b |
| `/admin/tool-leads` | Leads from the free tools, one row per email with its valuations behind an arrow (closed by default), with filters (tool, dates, deal size, below minimum, email status, test leads), detail with stored inputs and results, email events, resend and PDF download. **Admins can delete** a lead, a single valuation, or several ticked leads, each behind a confirmation |
| `/admin/growth` | Growth Engine (Unit 1.1, 2026-09-22): an empty section shell with its own sub-navigation over eleven pages (Home, Signals, Prospects, Outreach, Pipeline, Conversations, Meetings, Partners, Knowledge Base, Analytics, Settings), each stating its purpose and the build phase that delivers it. Pages are listed once in `src/lib/growth/pages.ts`; each page calls `requireGrowthSession` (`src/lib/growth/access.ts`) before rendering, on top of the middleware and admin layout. **Admin only since Unit 1.2**: `/admin/growth` is in `ADMIN_ONLY_PREFIXES`, the sidebar item carries `role: 'admin'`, and `requireGrowthSession` sends an editor to `/admin?denied=1`. Home shows whether the data layer (migration 083, `src/lib/growth/db.ts`) is ready, table by table. Value lists and row types are in `src/lib/growth/model.ts`; `npm run verify-growth-data` proves them against the migration |

### Sidebar (`src/components/admin/CmsAdminNav.tsx`)

Single component handling both desktop and mobile chrome (no separate `AdminSidebar` / `AdminMobileNav` / `LogoutButton` components: those were collapsed into this one in Phase 4.5).

- 240px expanded · 64px collapsed (icons only)
- Collapse persisted to `localStorage['pmbcAdminSidebarCollapsed']`
- Scroll position persisted to `sessionStorage['admin_sidebar_scroll']`, restored on `pathname` change
- Off-canvas drawer below 768px viewport with hamburger button + body-scroll lock + click-backdrop-to-close
- Active state by exact-match OR prefix-match against per-item `matchPaths` (e.g. "Page Builder" stays highlighted while inside `/admin/page-builder/...`, "Inquiries" also matches `/admin/leads`)
- Active item gets `#1B3A5F` background + **3px gold (`#C69C3E`) left border**
- Group dividers labeled `Content` / `Collections` / `Tools` / `Leads` / `Email` / `System` (FMP-parity order set in Phase 11), then `Growth` (Unit 1.1, 2026-09-22) after the existing entries. `Collections` holds the PMBC-only Phase 10 tables that have no FMP counterpart.
- Footer: external links to `https://www.pacemakersglobal.com` (View Live Site) and `https://www.financialmodelerpro.com` (Visit FMP), both `target="_blank"`. Sign-out lives below those.

### Admin styling

All admin pages use **inline styles**, not Tailwind utility classes. Shared design tokens live in `src/lib/admin/styles.ts`: colors, layout constants, and ready-made `CSSProperties` presets (`adminCard`, `adminInput`, `adminButtonPrimary`, etc.). This intentionally isolates the admin console from the public-site theme so future public-site work can't accidentally restyle the dashboard. The PMBC palette (deep navy `#0F2540` sidebar, navy `#1B3A5F` primary, gold `#C69C3E` accent, page bg `#F4F7FC`) is anchored here. Note the isolation is about structure, not the brand accent: Phase 11 moved the admin gold in step with the public gold (`#D4A93A` to `#C69C3E`) so the console does not visibly diverge from the site, while the structural colors (sidebar `#0F2540`, primary `#1B3A5F`) stay independent.

### Admin API conventions

- All `/api/admin/*` routes session-gate via `getAdminSession()` (401 if absent), zod-validate the body, and write an `audit_log` row on success.
- Mutations accept both `PATCH` (FMP-style) and `POST` (legacy alias) on `/api/admin/{content,branding,settings,email-branding,email-templates,header-settings}`.
- `/api/admin/content` GET returns `{ rows: [...] }`; PATCH does upsert (try update, then insert) on `(section, key)` pairs.
- `/api/admin/branding` GET returns `{ row: ... }`; mutations return the updated row in `{ row: ... }`.
- Errors always: `{ error: string }` + non-2xx status.

### Page Builder

Three-pane layout matching FMP's pattern:
- **Left pane**: list of sections on the current page with drag handles, visibility toggle, delete button, and "Add Section" button at bottom
- **Center pane**: editor for the currently selected section (the appropriate editor component from `editors/`), with that section's own Save header above it and a collapsible **StyleEditor** below it
- **Right pane**: live preview iframe pointed at the page (with `?preview=1` so hidden sections still render). **Hidden by default since 2026-08-02**, behind a "Preview" toggle in the top bar; the preference persists in `localStorage['pmbcPageBuilderPreviewVisible']`. Open, the centre splits 60/40 editor/preview; closed, the editor takes the full column. The pane unmounts rather than hiding with CSS, so a closed preview costs no page load. It still re-keys after every Save / Add / Delete / reorder. The "Open preview" link (new tab) stays regardless.

**Slug is not the URL.** `cms_pages.slug` and the public route diverged in Phase 7, when the catch-all `(public)/[slug]` was replaced by bespoke routes. Use `publicPathForPageSlug` / `previewPathForPageSlug` from `src/lib/cms/pageRoutes.ts`, never `` `/${slug}` ``. The exceptions are `home` to `/`, `service-<x>` to `/services/<x>` (9 pages), and `about-ahmad-din` to `/about/ahmad-din`. Both the page-builder preview and `/admin/og-preview` had hardcoded `` `/${slug}` `` and were pointing at 404s. A new nested page needs a line in that file.

**Save model (parity 3, matching FMP).** Each section owns its own Save. There is no global Save button. Dirty state is tracked per section id, never per page, so saving one section cannot flush another section's half-finished edit.

| Operation | Persists |
|---|---|
| Reorder (drag) | Immediately on drop |
| Add section | Immediately, server side, so the row has a stable id to edit against |
| Delete section | Immediately, behind the confirm dialog |
| Content edit | Pending until that section's Save |
| Visibility toggle | Pending until that section's Save |

Sections with pending edits show an amber dot in the left rail, and the top bar shows a count. A `beforeunload` guard fires while anything is unsaved.

---

## 13. Cross-Property Content (PMBC ↔ FMP)

PMBC and FMP are fully separate codebases and Supabase projects. They do not share data. They are linked only by hyperlinks.

### From PMBC to FMP

- The `/fmp` page on PMBC (the old `/financial-modeler-pro` path 301s there) introduces FMP and ends with a primary CTA "Visit Financial Modeler Pro" → links to `https://financialmodelerpro.com`
- The footer's Firm column links to `/fmp` (the footer has three columns since 2026-08-13: Brand, Firm, Contact)
- The About / Founder block on PMBC mentions FMP as Ahmad's platform. **Since 2026-08-02 the full bio lives on PMBC's own `/about/ahmad-din`,** not on FMP. The home founder card links there ("Read the full profile"). See the reversal note under Critical Reminder 4.

### From FMP to PMBC

(Already exists.) FMP's home page has a "Powered by PaceMakers Business Consultants" section with a "Visit PaceMakers" button → links to `https://pacemakersglobal.com`.

### Articles

Articles are PMBC's own since Phase 10: the `articles` table, `/admin/articles`, and public `/insights` and `/insights/[slug]`. Cross-posting from FMP is possible but not wired. (Replaced on 2026-09-22 a note that articles would live on FMP.)

## Environment defaults

The non-secret values the project runs with, moved from the original CLAUDE.md environment block on 2026-09-22. Every other variable holds a secret or an optional setting; its name and purpose are in CLAUDE.md section 11, and its value lives only on Vercel and in `.env.local`, never in the repository.

| Variable | Value |
|----------|-------|
| `NEXTAUTH_URL` | `https://pacemakersglobal.com` |
| `NEXT_PUBLIC_SITE_URL` | `https://pacemakersglobal.com` |
| `EMAIL_FROM_DEFAULT` | `info@pacemakersglobal.com` |
| `EMAIL_FROM_NAME` | `PaceMakers Business Consultants` |
| `EMAIL_TO_ADMIN` | `advisory@pacemakersglobal.com` |
| `FMP_API_URL` | `https://app.financialmodelerpro.com` |

`EMAIL_FROM_CONTACT` and `NEXT_PUBLIC_GA_ID` are optional and ship blank. `HCAPTCHA_SECRET_KEY` and `NEXT_PUBLIC_HCAPTCHA_SITE_KEY` are deliberately unset (the forms use a honeypot and a timing floor).
