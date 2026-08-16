-- 072_testimonial_submissions.sql
-- Clients can submit their own testimonial, and Ahmad approves it before
-- anything appears.
--
-- **DDL. This one has to be pasted into the Supabase SQL editor by hand**, like
-- 031, 032 and 033 before it: supabase-js cannot run ALTER TABLE or CREATE
-- TABLE, and this repository has no direct Postgres connection string.
-- `npm run seed-testimonial-submissions` checks whether it has been applied and
-- says what is missing, but it cannot apply it.
--
-- **Everything reads this defensively.** Until it runs: the submission form
-- section refuses politely rather than erroring, the public testimonials block
-- renders exactly as it does today, and the links screen reports the table as
-- absent. Nothing 500s. That is the same contract 031 to 033 established, and
-- it is what makes a hand-run migration safe to ship ahead of being applied.
--
-- What FMP does, and where PMBC differs. FMP's `/testimonials/submit` is a
-- fixed page posting to `/api/testimonials`, inserting with `status = 'pending'`
-- and a `source` column recording where the row came from. PMBC copies the
-- status flow and the `source` column, and its `linkedin_url` (FMP carries that
-- on `student_testimonials`). The rest is PMBC-only, because FMP has no
-- equivalent: placement as a section rather than a fixed URL, private links,
-- explicit consent, a photo, spam handling and an email notification.
--
-- Consent is recorded rather than assumed. `/confidentiality` commits the firm
-- to not publishing a client's involvement without agreement, so a testimonial
-- with no recorded consent is a testimonial that cannot be published, and the
-- column is what makes that checkable a year later rather than a matter of
-- someone's memory.

BEGIN;

-- 1. The columns a submitted testimonial needs.
--
--    `source` mirrors FMP's: 'admin' for a row typed into the console, 'form'
--    for a public submission, 'link' for one that arrived through a private
--    link. Existing rows predate submissions, so they default to 'admin'.
ALTER TABLE testimonials
  ADD COLUMN IF NOT EXISTS linkedin_url TEXT,
  ADD COLUMN IF NOT EXISTS photo_url TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'admin',
  ADD COLUMN IF NOT EXISTS consent_given BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS submitted_via_link_id UUID;

-- 2. Reusable private links.
--
--    No expiry, by instruction. A link stays valid until it is revoked, which
--    is `active = false` rather than a delete: a revoked link must still be
--    joinable from the testimonials it produced, or the answer to "where did
--    this come from" disappears with it.
--
--    `token` is the secret in the URL. Unique, and long enough that guessing is
--    not a route in: the API generates 32 bytes of base64url.
CREATE TABLE IF NOT EXISTS testimonial_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  -- Who this link was sent to, in Ahmad's words. The only way to tell two
  -- links apart in the admin, so it is required rather than optional.
  label TEXT NOT NULL,
  note TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES admin_users(id),
  last_used_at TIMESTAMPTZ,
  use_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_testimonial_links_token ON testimonial_links(token);
CREATE INDEX IF NOT EXISTS idx_testimonials_source ON testimonials(source, status);

-- 3. The join from a testimonial back to the link that produced it. Added after
--    the table exists, and guarded so a re-run is a no-op.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'testimonials_submitted_via_link_id_fkey'
  ) THEN
    ALTER TABLE testimonials
      ADD CONSTRAINT testimonials_submitted_via_link_id_fkey
      FOREIGN KEY (submitted_via_link_id) REFERENCES testimonial_links(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 4. RLS on the new table, matching migration 013's posture for every other
--    table: the service role reaches it, nobody else does. There is no public
--    read here at all. A token is checked server side by a route holding the
--    service key, so the browser never queries this table and must not be able
--    to: a public read would let anyone enumerate every live link.
ALTER TABLE testimonial_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages testimonial links" ON testimonial_links;
CREATE POLICY "Service role manages testimonial links" ON testimonial_links
  FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMIT;
