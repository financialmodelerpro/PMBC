-- 091_growth_meetings.sql
-- Growth Engine Phase 5, Meetings (Units 5.1 to 5.3, 2026-09-23): booked
-- calls from Microsoft Bookings or added by hand, the brief before each call,
-- notes and outcome after it, and recap and no-show drafts.
--
-- DDL, HAND-RUN in the Supabase SQL editor (supabase-js cannot run DDL).
--
-- SAFE TO APPLY: after 090, and before or after the deploy of any Phase 5
-- unit. It adds one Growth table and columns with defaults; no table outside
-- Growth is touched. Until it is applied the Meetings screen shows a migration
-- notice, the Bookings sync previews only and saves nothing, and no brief,
-- recap or no-show draft is made.
--
-- Idempotent: IF NOT EXISTS throughout, constraints dropped before they are
-- re-created.
--
-- WHAT CHANGES
-- 1. growth_meetings: one row per call, keyed by the Bookings appointment id
--    when it came from Bookings (unique), matched to a lead and contact, with
--    status (scheduled, rescheduled, cancelled, completed, no show), the
--    previous time when rescheduled, the brief (JSON, with its mock flag), and
--    notes and outcome after the call. By constraint, an outcome needs the
--    call to be completed, and a mock row is never a Bookings row.
-- 2. growth_messages.meeting_id: recap and no-show drafts point at their call.
-- 3. growth_settings.bookings_url: the Microsoft Bookings page offered to
--    qualified leads (empty until set; https only).
--
-- ACCESS
-- As 083 to 090: RLS on with no policies, every privilege revoked from anon
-- and authenticated.

BEGIN;

CREATE TABLE IF NOT EXISTS growth_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_test BOOLEAN NOT NULL DEFAULT false,
  is_mock BOOLEAN NOT NULL DEFAULT false,

  source TEXT NOT NULL CHECK (source IN ('bookings', 'manual')),
  external_id TEXT,
  CONSTRAINT growth_meetings_mock_not_bookings CHECK (NOT (is_mock AND source = 'bookings')),

  lead_id UUID REFERENCES growth_leads (id),
  contact_id UUID REFERENCES growth_contacts (id),
  company_id UUID REFERENCES growth_companies (id),
  attendee_name TEXT,
  attendee_email TEXT CHECK (attendee_email IS NULL OR attendee_email = lower(btrim(attendee_email))),

  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  previous_starts_at TIMESTAMPTZ,
  CONSTRAINT growth_meetings_ends_after_start CHECK (ends_at IS NULL OR ends_at > starts_at),
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'rescheduled', 'cancelled', 'completed', 'no_show')),
  service_name TEXT,
  join_url TEXT CHECK (join_url IS NULL OR join_url ~* '^https://'),
  customer_notes TEXT,

  brief JSONB CHECK (brief IS NULL OR jsonb_typeof(brief) = 'object'),
  brief_is_mock BOOLEAN NOT NULL DEFAULT false,
  brief_usage_id UUID REFERENCES growth_ai_usage (id),
  brief_at TIMESTAMPTZ,

  notes TEXT,
  outcome TEXT CHECK (outcome IS NULL OR outcome IN ('positive', 'proposal_requested', 'needs_follow_up', 'not_a_fit', 'other')),
  outcome_at TIMESTAMPTZ,
  CONSTRAINT growth_meetings_outcome_after_call CHECK (outcome IS NULL OR status = 'completed'),

  synced_at TIMESTAMPTZ,
  created_by_name TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS growth_meetings_external_key ON growth_meetings (external_id) WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_growth_meetings_starts ON growth_meetings (starts_at);
CREATE INDEX IF NOT EXISTS idx_growth_meetings_lead ON growth_meetings (lead_id);

DROP TRIGGER IF EXISTS growth_meetings_updated_at ON growth_meetings;
CREATE TRIGGER growth_meetings_updated_at BEFORE UPDATE ON growth_meetings
  FOR EACH ROW EXECUTE FUNCTION growth_set_updated_at();

ALTER TABLE growth_messages ADD COLUMN IF NOT EXISTS meeting_id UUID REFERENCES growth_meetings (id);
CREATE INDEX IF NOT EXISTS idx_growth_messages_meeting ON growth_messages (meeting_id) WHERE meeting_id IS NOT NULL;

ALTER TABLE growth_settings ADD COLUMN IF NOT EXISTS bookings_url TEXT NOT NULL DEFAULT '';
ALTER TABLE growth_settings DROP CONSTRAINT IF EXISTS growth_settings_bookings_url_check;
ALTER TABLE growth_settings ADD CONSTRAINT growth_settings_bookings_url_check CHECK (bookings_url = '' OR bookings_url ~* '^https://[^[:space:]]+$');

ALTER TABLE growth_meetings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE growth_meetings FROM anon, authenticated;

COMMIT;
