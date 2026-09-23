-- 089_growth_outreach.sql
-- Growth Engine Phase 3, Outreach and Pipeline (Units 3.1 to 3.5,
-- 2026-09-23): messages and their approval, tracked links and clicks,
-- opportunities, tasks, the Lead Score and the outreach settings.
--
-- DDL, HAND-RUN in the Supabase SQL editor (supabase-js cannot run DDL).
--
-- SAFE TO APPLY: after 088, and before or after the deploy of any Phase 3
-- unit. It only adds Growth tables and columns with defaults; no table
-- outside Growth is touched. Until it is applied, the Outreach and Pipeline
-- screens show a migration notice, nothing can be drafted, approved or sent,
-- tracked links answer with a plain redirect to the home page, and the Lead
-- Score is shown but not stored. Nothing is sent in the gap.
--
-- Idempotent: IF NOT EXISTS throughout, constraints and triggers dropped
-- before they are re-created.
--
-- WHAT CHANGES
-- 1. growth_messages: every outreach draft and send, email or LinkedIn, with
--    the trigger it cites, the page it links to, approval (who, when),
--    rejection (why), scheduling, the send (Microsoft Graph, mock or by hand)
--    and replies. By constraint: a rejection needs a reason, a send needs a
--    time and a mode, and a draft written by the mock AI can never be sent
--    through Microsoft Graph. Status changes are logged to growth_activity by
--    a trigger.
-- 2. growth_tracked_links and growth_link_clicks: one unguessable token per
--    link (or opt-out link) in a message, and each click with a hashed IP.
--    Targets must be site paths, so a link can never redirect off the site.
-- 3. growth_opportunities: service, value band, expected close, won or lost
--    (lost needs a reason).
-- 4. growth_tasks: to-dos with due dates, on a lead or company.
-- 5. growth_leads: the outreach sequence state (next follow-up, stopped and
--    why), reply and meeting-request flags and when the Lead Score was set.
-- 6. growth_settings: outreach_sending_paused, and lead_scoring_weights
--    (seven factors summing to 100, checked).
--
-- ACCESS
-- As 083 to 088: RLS on with no policies, every privilege revoked from anon
-- and authenticated. The public tracked-link and opt-out routes use the
-- service role on the server.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Messages
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS growth_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_test BOOLEAN NOT NULL DEFAULT false,

  lead_id UUID REFERENCES growth_leads (id),
  company_id UUID REFERENCES growth_companies (id),
  contact_id UUID REFERENCES growth_contacts (id),
  signal_id UUID REFERENCES growth_signals (id),

  channel TEXT NOT NULL CHECK (channel IN ('email', 'linkedin')),
  kind TEXT NOT NULL DEFAULT 'initial' CHECK (kind IN ('initial', 'follow_up', 'recap', 'no_show', 'manual', 'nurture', 'lead_magnet')),
  sequence_step INTEGER NOT NULL DEFAULT 0 CHECK (sequence_step BETWEEN 0 AND 10),
  subject TEXT,
  body TEXT NOT NULL CHECK (length(btrim(body)) > 0),
  -- The site page the message links to, e.g. /services/refm.
  link_path TEXT CHECK (link_path IS NULL OR link_path ~ '^/[^/]'),

  is_mock_ai BOOLEAN NOT NULL DEFAULT false,
  ai_usage_id UUID REFERENCES growth_ai_usage (id),
  edited BOOLEAN NOT NULL DEFAULT false,

  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'rejected', 'scheduled', 'sent', 'failed', 'cancelled')),
  approved_at TIMESTAMPTZ,
  approved_by_name TEXT,
  rejected_reason TEXT,
  cancelled_reason TEXT,
  scheduled_for TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  send_mode TEXT CHECK (send_mode IS NULL OR send_mode IN ('graph', 'mock', 'manual', 'brevo')),
  provider_message_id TEXT,
  provider_conversation_id TEXT,
  error TEXT,
  replied_at TIMESTAMPTZ,

  CONSTRAINT growth_messages_rejection_needs_reason CHECK (status <> 'rejected' OR length(btrim(coalesce(rejected_reason, ''))) > 0),
  CONSTRAINT growth_messages_approval_recorded CHECK (status NOT IN ('approved', 'scheduled', 'sent') OR approved_at IS NOT NULL OR kind IN ('nurture', 'lead_magnet')),
  CONSTRAINT growth_messages_send_recorded CHECK (status <> 'sent' OR (sent_at IS NOT NULL AND send_mode IS NOT NULL)),
  CONSTRAINT growth_messages_mock_never_real CHECK (NOT (is_mock_ai AND send_mode IN ('graph', 'brevo'))),
  CONSTRAINT growth_messages_email_subject CHECK (channel <> 'email' OR status IN ('draft', 'rejected', 'cancelled') OR length(btrim(coalesce(subject, ''))) > 0)
);

CREATE INDEX IF NOT EXISTS idx_growth_messages_status ON growth_messages (status, is_test, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_growth_messages_lead ON growth_messages (lead_id, created_at);
CREATE INDEX IF NOT EXISTS idx_growth_messages_sent ON growth_messages (sent_at) WHERE sent_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_growth_messages_scheduled ON growth_messages (scheduled_for) WHERE status = 'scheduled';

DROP TRIGGER IF EXISTS growth_messages_updated_at ON growth_messages;
CREATE TRIGGER growth_messages_updated_at BEFORE UPDATE ON growth_messages
  FOR EACH ROW EXECUTE FUNCTION growth_set_updated_at();

-- Every status change is logged, whatever code made it.
CREATE OR REPLACE FUNCTION growth_messages_log_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;
  INSERT INTO growth_activity (is_test, company_id, contact_id, lead_id, signal_id, actor_type, actor_id, action, summary, metadata)
  VALUES (
    NEW.is_test, NEW.company_id, NEW.contact_id, NEW.lead_id, NEW.signal_id,
    'system', 'outreach',
    'outreach.' || NEW.status,
    initcap(NEW.channel) || ' ' || replace(NEW.kind, '_', ' ') || ' ' ||
      CASE NEW.status
        WHEN 'draft' THEN 'drafted' || CASE WHEN NEW.is_mock_ai THEN ' (mock AI)' ELSE '' END
        WHEN 'approved' THEN 'approved by ' || coalesce(NEW.approved_by_name, 'Ahmad')
        WHEN 'rejected' THEN 'rejected: ' || coalesce(NEW.rejected_reason, '')
        WHEN 'scheduled' THEN 'scheduled for ' || coalesce(to_char(NEW.scheduled_for AT TIME ZONE 'Asia/Riyadh', 'DD Mon YYYY HH24:MI') || ' Riyadh', 'the next sending window')
        WHEN 'sent' THEN 'sent' || CASE NEW.send_mode WHEN 'mock' THEN ' in mock mode (not delivered)' WHEN 'manual' THEN ' by hand' ELSE '' END
        WHEN 'failed' THEN 'failed: ' || coalesce(NEW.error, '')
        ELSE 'cancelled: ' || coalesce(NEW.cancelled_reason, '')
      END,
    jsonb_build_object('message_id', NEW.id, 'from', CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE NULL END, 'to', NEW.status, 'channel', NEW.channel, 'kind', NEW.kind, 'step', NEW.sequence_step, 'mock_ai', NEW.is_mock_ai, 'send_mode', NEW.send_mode)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS growth_messages_log_status ON growth_messages;
CREATE TRIGGER growth_messages_log_status AFTER INSERT OR UPDATE ON growth_messages
  FOR EACH ROW EXECUTE FUNCTION growth_messages_log_status();

-- ---------------------------------------------------------------------------
-- 2. Tracked links and clicks
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS growth_tracked_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  is_test BOOLEAN NOT NULL DEFAULT false,
  token TEXT NOT NULL CHECK (length(token) >= 20),
  kind TEXT NOT NULL DEFAULT 'link' CHECK (kind IN ('link', 'opt_out')),
  lead_id UUID REFERENCES growth_leads (id),
  contact_id UUID REFERENCES growth_contacts (id),
  message_id UUID REFERENCES growth_messages (id),
  -- A path on the site only: a tracked link can never redirect elsewhere.
  target_path TEXT NOT NULL CHECK (target_path ~ '^/([^/].*)?$'),
  click_count INTEGER NOT NULL DEFAULT 0 CHECK (click_count >= 0),
  last_clicked_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS growth_tracked_links_token_key ON growth_tracked_links (token);
CREATE INDEX IF NOT EXISTS idx_growth_tracked_links_lead ON growth_tracked_links (lead_id);

CREATE TABLE IF NOT EXISTS growth_link_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  is_test BOOLEAN NOT NULL DEFAULT false,
  link_id UUID NOT NULL REFERENCES growth_tracked_links (id),
  ip_hash TEXT,
  user_agent TEXT CHECK (user_agent IS NULL OR length(user_agent) <= 300)
);

CREATE INDEX IF NOT EXISTS idx_growth_link_clicks_link ON growth_link_clicks (link_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 3. Opportunities
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS growth_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_test BOOLEAN NOT NULL DEFAULT false,
  lead_id UUID NOT NULL REFERENCES growth_leads (id),
  service TEXT NOT NULL CHECK (service IN (
    'financial-modeling', 'business-valuation', 'financial-due-diligence', 'transaction-advisory',
    'mergers-acquisitions', 'refm', 'project-finance', 'investment-memorandums', 'cfo-advisory'
  )),
  -- Expected fee, SAR.
  value_band TEXT NOT NULL DEFAULT 'unknown' CHECK (value_band IN ('unknown', 'under_100k', '100k_250k', '250k_500k', '500k_1m', 'over_1m')),
  expected_close DATE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'won', 'lost')),
  lost_reason TEXT,
  notes TEXT,
  closed_at TIMESTAMPTZ,
  CONSTRAINT growth_opportunities_lost_needs_reason CHECK (status <> 'lost' OR length(btrim(coalesce(lost_reason, ''))) > 0)
);

CREATE INDEX IF NOT EXISTS idx_growth_opportunities_lead ON growth_opportunities (lead_id);

DROP TRIGGER IF EXISTS growth_opportunities_updated_at ON growth_opportunities;
CREATE TRIGGER growth_opportunities_updated_at BEFORE UPDATE ON growth_opportunities
  FOR EACH ROW EXECUTE FUNCTION growth_set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. Tasks
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS growth_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_test BOOLEAN NOT NULL DEFAULT false,
  lead_id UUID REFERENCES growth_leads (id),
  company_id UUID REFERENCES growth_companies (id),
  title TEXT NOT NULL CHECK (length(btrim(title)) > 0),
  notes TEXT,
  due_date DATE,
  done_at TIMESTAMPTZ,
  done_by_name TEXT,
  created_by_name TEXT
);

CREATE INDEX IF NOT EXISTS idx_growth_tasks_open ON growth_tasks (due_date) WHERE done_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_growth_tasks_lead ON growth_tasks (lead_id);

DROP TRIGGER IF EXISTS growth_tasks_updated_at ON growth_tasks;
CREATE TRIGGER growth_tasks_updated_at BEFORE UPDATE ON growth_tasks
  FOR EACH ROW EXECUTE FUNCTION growth_set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. Leads: sequence, replies, meeting requests, Lead Score time
-- ---------------------------------------------------------------------------
ALTER TABLE growth_leads ADD COLUMN IF NOT EXISTS sequence_status TEXT NOT NULL DEFAULT 'none';
ALTER TABLE growth_leads DROP CONSTRAINT IF EXISTS growth_leads_sequence_status_check;
ALTER TABLE growth_leads ADD CONSTRAINT growth_leads_sequence_status_check CHECK (sequence_status IN ('none', 'active', 'stopped', 'completed'));
ALTER TABLE growth_leads ADD COLUMN IF NOT EXISTS sequence_started_at TIMESTAMPTZ;
ALTER TABLE growth_leads ADD COLUMN IF NOT EXISTS next_follow_up_at TIMESTAMPTZ;
ALTER TABLE growth_leads ADD COLUMN IF NOT EXISTS sequence_stopped_reason TEXT;
ALTER TABLE growth_leads ADD COLUMN IF NOT EXISTS last_reply_at TIMESTAMPTZ;
ALTER TABLE growth_leads ADD COLUMN IF NOT EXISTS meeting_requested BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE growth_leads ADD COLUMN IF NOT EXISTS lead_scored_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_growth_leads_follow_up ON growth_leads (next_follow_up_at) WHERE sequence_status = 'active';

-- ---------------------------------------------------------------------------
-- 6. Settings
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION growth_lead_weights_ok(w JSONB)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT jsonb_typeof(w) = 'object'
    AND (SELECT count(*) FROM jsonb_object_keys(w)) = 7
    AND w ?& ARRAY['icp_fit', 'clear_need', 'scale', 'timeline', 'authority', 'engagement', 'meeting_intent']
    AND (SELECT bool_and(jsonb_typeof(v) = 'number' AND (v)::text ~ '^[0-9]+$' AND (v)::text::int BETWEEN 0 AND 100) FROM jsonb_each(w) AS e(k, v))
    AND (SELECT sum((v)::text::int) FROM jsonb_each(w) AS e(k, v)) = 100;
$$;

ALTER TABLE growth_settings ADD COLUMN IF NOT EXISTS outreach_sending_paused BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE growth_settings ADD COLUMN IF NOT EXISTS lead_scoring_weights JSONB NOT NULL DEFAULT
  '{"icp_fit": 25, "clear_need": 20, "scale": 15, "timeline": 15, "authority": 10, "engagement": 10, "meeting_intent": 5}'::jsonb;
ALTER TABLE growth_settings DROP CONSTRAINT IF EXISTS growth_settings_lead_weights_check;
ALTER TABLE growth_settings ADD CONSTRAINT growth_settings_lead_weights_check CHECK (growth_lead_weights_ok(lead_scoring_weights));

-- ---------------------------------------------------------------------------
-- Access: service role only
-- ---------------------------------------------------------------------------
ALTER TABLE growth_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth_tracked_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth_link_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth_tasks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE growth_messages, growth_tracked_links, growth_link_clicks, growth_opportunities, growth_tasks FROM anon, authenticated;
REVOKE ALL ON FUNCTION growth_messages_log_status(), growth_lead_weights_ok(JSONB) FROM PUBLIC, anon, authenticated;

COMMIT;
