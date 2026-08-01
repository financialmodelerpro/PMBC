-- ============================================================
--  001_cms_schema.sql
--  PaceMakers CMS schema. Run this once, in the Supabase SQL editor of the
--  PACEMAKERS project. Do not run it against any other database.
--
--  Every definition here is lifted from the schema the copied admin code
--  already expects, so the screens work without modification. Column names are
--  deliberately unchanged even where they read oddly (testimonials uses `name`,
--  `role` and `text` rather than author/quote), because changing them would
--  mean editing working UI code for cosmetic reasons.
--
--  Two departures from the original, both because the concepts do not exist
--  here:
--    - articles.author_id has no users table to point at, so it is a plain uuid
--      with no foreign key.
--    - there is no student_testimonials table and no `hub` column.
--
--  Idempotent: CREATE TABLE IF NOT EXISTS throughout, safe to re-run.
--  No em dashes anywhere in this file.
-- ============================================================

-- -- Page Builder ------------------------------------------------------------
-- One row per section on a page. `content` is the section's own shape, which is
-- why it is jsonb: a hero and a FAQ block store completely different fields.
CREATE TABLE IF NOT EXISTS page_sections (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_slug     text NOT NULL,
  section_type  text NOT NULL,
  content       jsonb NOT NULL DEFAULT '{}',
  display_order int NOT NULL DEFAULT 0,
  visible       boolean NOT NULL DEFAULT true,
  styles        jsonb DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS page_sections_page_idx ON page_sections(page_slug, display_order);

-- The pages themselves (Page Builder's page list).
CREATE TABLE IF NOT EXISTS cms_pages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            text UNIQUE NOT NULL,
  title           text NOT NULL DEFAULT '',
  seo_title       text DEFAULT '',
  seo_description text DEFAULT '',
  status          text NOT NULL DEFAULT 'draft',
  is_system       boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- -- Page Content and Header Settings ----------------------------------------
-- A key/value store, grouped by section. Both screens read and write this one
-- table; Header Settings is simply the rows where section = 'header_settings'.
CREATE TABLE IF NOT EXISTS cms_content (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section    text NOT NULL,
  key        text NOT NULL,
  value      text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (section, key)
);

-- -- Pages & Nav -------------------------------------------------------------
-- The navigation menu. Separate from cms_pages: a nav item can point anywhere,
-- including an external URL or an anchor.
CREATE TABLE IF NOT EXISTS site_pages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label         text NOT NULL,
  href          text NOT NULL,
  visible       boolean NOT NULL DEFAULT true,
  display_order int NOT NULL DEFAULT 0,
  can_toggle    boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- -- Articles ----------------------------------------------------------------
-- author_id keeps its column so the copied code can write it, but has NO
-- foreign key here: there is no users table on this site yet. Add one later if
-- you introduce accounts.
CREATE TABLE IF NOT EXISTS articles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title           text NOT NULL,
  slug            text NOT NULL UNIQUE,
  body            text NOT NULL DEFAULT '',
  cover_url       text,
  category        text NOT NULL DEFAULT 'General',
  author_id       uuid,
  status          text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','scheduled')),
  seo_title       text,
  seo_description text,
  featured        boolean NOT NULL DEFAULT false,
  published_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  -- Columns the copied editor writes. In the original these arrived across a
  -- dozen later migrations; here they are simply part of the table. The route
  -- is schema-tolerant and retries without them, so a missing one degrades
  -- rather than failing the save, but you want them present.
  mid_image_url      text,
  mid_image_caption  text,
  og_image_url       text,
  tags               text[] DEFAULT '{}',
  writer_id          uuid,
  writer_name        text,
  writer_title       text,
  writer_avatar_url  text,
  author_bio         text,
  author_profile_url text,
  hero_before_content boolean NOT NULL DEFAULT false,
  scheduled_at       timestamptz,
  series_id          uuid,
  series_order       integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS articles_status_idx ON articles(status, published_at DESC);
CREATE INDEX IF NOT EXISTS articles_slug_idx   ON articles(slug);

CREATE TABLE IF NOT EXISTS categories (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  slug       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT categories_name_unique UNIQUE (name),
  CONSTRAINT categories_slug_unique UNIQUE (slug)
);

CREATE TABLE IF NOT EXISTS article_categories (
  article_id  uuid NOT NULL REFERENCES articles(id)   ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (article_id, category_id)
);

-- Reading sequences ("Part 2 of 5"). Deleting a series un-groups its articles,
-- it never deletes them.
CREATE TABLE IF NOT EXISTS article_series (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  slug        text NOT NULL,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT article_series_slug_unique UNIQUE (slug)
);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'articles_series_fk'
  ) THEN
    ALTER TABLE articles
      ADD CONSTRAINT articles_series_fk
      FOREIGN KEY (series_id) REFERENCES article_series(id) ON DELETE SET NULL;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS articles_series_idx ON articles(series_id, series_order);

-- -- Testimonials ------------------------------------------------------------
-- Column names kept from the original so the admin screen needs no changes.
-- `name` is the person, `text` is the quote, `role` is their job title.
CREATE TABLE IF NOT EXISTS testimonials (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  role        text NOT NULL DEFAULT '',
  company     text NOT NULL DEFAULT '',
  text        text NOT NULL,
  rating      int NOT NULL DEFAULT 5 CHECK (rating BETWEEN 1 AND 5),
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  source      text NOT NULL DEFAULT 'form',
  is_featured boolean NOT NULL DEFAULT false,
  display_order int NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now(),
  approved_at timestamptz
);

-- -- Contact form ------------------------------------------------------------
-- Not part of the seven admin screens, but the public site almost certainly
-- needs it and it costs nothing to create now.
CREATE TABLE IF NOT EXISTS contact_submissions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  email      text NOT NULL,
  subject    text NOT NULL DEFAULT '',
  message    text NOT NULL,
  read       boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- -- Row level security ------------------------------------------------------
-- Everything is written server-side through the service role, which bypasses
-- RLS. Enable it with NO permissive policy so the anon and authenticated keys
-- cannot read or write these tables directly from a browser.
--
-- If you later render the public site with the ANON key rather than the service
-- role, you will need a read policy on the public-facing tables. Add it then,
-- deliberately, rather than leaving these open now.
ALTER TABLE page_sections       ENABLE ROW LEVEL SECURITY;
ALTER TABLE cms_pages           ENABLE ROW LEVEL SECURITY;
ALTER TABLE cms_content         ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_pages          ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories          ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_categories  ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_series      ENABLE ROW LEVEL SECURITY;
ALTER TABLE testimonials        ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_submissions ENABLE ROW LEVEL SECURITY;

-- -- Media library storage ---------------------------------------------------
-- The Media Library uploads into this bucket. Public read so images can be used
-- on the site; writes still go through the service role.
INSERT INTO storage.buckets (id, name, public)
VALUES ('cms-assets', 'cms-assets', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'cms_assets_public_read'
  ) THEN
    CREATE POLICY cms_assets_public_read ON storage.objects
      FOR SELECT USING (bucket_id = 'cms-assets');
  END IF;
END $$;

-- -- Article authors ---------------------------------------------------------
-- Called "instructors" because the original site taught courses. The name is
-- kept so the copied article editor and its author picker work unmodified; here
-- they are simply the people who write articles. Their photo and bio are
-- snapshotted onto an article at save time, so editing a person later does not
-- silently rewrite past bylines.
CREATE TABLE IF NOT EXISTS instructors (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  title       text,
  photo_url   text,
  bio         text,
  profile_url text,
  is_default  boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE instructors ENABLE ROW LEVEL SECURITY;
