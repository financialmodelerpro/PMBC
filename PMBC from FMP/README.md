# PaceMakers site

A standalone copy of the FMP content management system, carrying only the seven
content tools: Page Builder, Header Settings, Page Content, Pages & Nav,
Articles, Testimonials, Media Library.

Nothing here is connected to Financial Modeler Pro. Separate repo, separate
Vercel project, separate Supabase database. The FMP repo was not modified to
produce this.

---

## Getting it running

**1. Install**

```bash
cd PMBC
npm install
```

**2. Create the Supabase project**

Make a new Supabase project for PaceMakers. Do not point this at the FMP
database. The CMS tables here use the same names as FMP's (`page_sections`,
`cms_content`, `articles`, ...), so sharing a database would mean both admins
editing the same rows and PaceMakers edits appearing on financialmodelerpro.com.

**3. Create the schema**

Open the SQL editor in the new project, paste `supabase/migrations/001_cms_schema.sql`,
run it. It is idempotent, so re-running is safe.

**4. Configure**

Copy `.env.example` to `.env.local` and fill it in.

```bash
cp .env.example .env.local
```

`ADMIN_PASSWORD` and `ADMIN_SESSION_SECRET` are both required. If either is
missing, every admin route denies. That is deliberate, see "A note on the
login" below.

**5. Run**

```bash
npm run dev
```

Open http://localhost:3000/admin/login, sign in with `ADMIN_PASSWORD`, and you
land on the dashboard with all seven tools.

---

## What changed from the FMP original

Most files are copied verbatim so they behave exactly as you are used to. The
differences are all places where an FMP concept has no meaning here.

| Change | Why |
|---|---|
| Sidebar shows only the seven content tools | The Modeling Hub and Training Hub sections were removed |
| Login is one shared password | The original used NextAuth against a `users` table with roles. There is one admin here. See below |
| Newsletter on publish, removed | It emailed FMP students and subscribers. No such list exists here |
| Announce button on articles, removed | Same reason |
| Testimonials rewritten | The original merged two sources and carried a Training/Modeling `hub` column. This is one plain list |
| `articles.author_id` has no foreign key | There is no `users` table to point at yet |

Placeholder copy still says "Financial Modeler Pro" in a few default values
inside Page Content (the privacy policy sample text, a logo alt attribute, a
support email placeholder). Those are editable defaults, not wiring. Change them
in the admin UI as you build out the site.

---

## A note on the login

`src/shared/auth/adminAuth.ts` **fails closed**: if `ADMIN_PASSWORD` or
`ADMIN_SESSION_SECRET` is unset, every check denies rather than allowing.

This is not paranoia, it is a bug that actually happened in the parent codebase.
An email endpoint there was written as:

```ts
const secret = process.env.RESEND_WEBHOOK_SECRET;
if (secret) { /* check the bearer token */ }
```

The secret was set locally and never set in production, so the check never ran
and the endpoint accepted anonymous requests for months. It looked perfectly
secure on a developer machine. An unset secret must mean **closed**, never open.

The password is compared in constant time and the session cookie is HttpOnly,
signed with HMAC, and expires after 12 hours.

**Before you put this on a public domain:** a single shared password is
reasonable for one person building a marketing site. If more people need access,
or you want an audit trail of who changed what, replace it with real accounts.
`src/shared/auth/session.ts` exists precisely so that swap does not require
touching any of the copied CMS routes.

---

## Layout

```
app/
  admin/
    login/            sign in
    cms/              dashboard, the launcher
    page-builder/     sections per page
    header-settings/  logo, header copy, brand colour
    content/          key/value text blocks
    pages/            pages and navigation
    articles/         list, new, edit, categories, series
    testimonials/     client quotes
    media/            image library
  api/admin/          the routes behind all of the above
src/
  components/admin/   the shared editors (rich text, media picker, ...)
  shared/auth/        the login, and the two shims that replace NextAuth
  core/db/supabase.ts server and browser Supabase clients
supabase/migrations/  the schema
scripts/              one-off rewiring used to produce this copy
```

---

## What is not here

The public-facing site. This is the admin and its data layer only: the thing
that lets you enter content. Rendering that content into pages is the next
piece, and it is deliberately separate so you can design the PaceMakers front
end however you want rather than inheriting FMP's.

The Page Builder writes `page_sections` rows with a `section_type` and a
`content` blob. A public page renders by reading the rows for its slug in
`display_order` and switching on `section_type`. That is the whole contract.

---

## What was verified, and what was not

**Verified.** `npm install`, `npm run type-check` (0 errors) and
`npm run build` all pass. Every screen compiles and all 14 admin pages plus 10
API routes appear in the build output.

**Not verified.** Nothing has been run against a real database, because the
PaceMakers Supabase project does not exist yet. So the schema in
`001_cms_schema.sql` is derived from the definitions the copied code expects,
but no query has actually executed against it.

Expect the first real session to surface small mismatches, most likely in the
article editor, which touches the widest surface of the original schema. If a
save fails, the error message from Supabase will name the column, and the fix is
usually one line in the migration.

The article routes are deliberately schema-tolerant: if an optional column is
missing they retry the write without it rather than failing, so a gap degrades
instead of blocking you.
