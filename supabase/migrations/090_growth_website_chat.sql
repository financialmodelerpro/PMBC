-- 090_growth_website_chat.sql
-- Growth Engine Phase 4, Website AI (Units 4.1 to 4.3, 2026-09-23): chat
-- conversations and their messages, consent, qualification and routing, the
-- chat settings (the widget is OFF by default), and one link per valuation
-- tool lead.
--
-- DDL, HAND-RUN in the Supabase SQL editor (supabase-js cannot run DDL).
--
-- SAFE TO APPLY: after 089, and before or after the deploy of any Phase 4
-- unit. It adds Growth tables and settings columns only; chat_widget_enabled
-- defaults to false, so applying it changes nothing on the public site. Until
-- it is applied the widget cannot be switched on (the setting has no column),
-- the chat API answers 404, and the Conversations screen shows a migration
-- notice. The valuation tool's tables are never altered.
--
-- Idempotent: IF NOT EXISTS throughout, constraints dropped before they are
-- re-created.
--
-- WHAT CHANGES
-- 1. growth_conversations: one row per chat, with the page it started on, a
--    tracked link when the visitor came from an outreach email, the lead and
--    contact it is linked to, qualification answers (JSON), temperature and
--    route (hot, warm, cold, escalated), and consent. By constraint, contact
--    details can only be stored with consent, and consent records its wording
--    and time.
-- 2. growth_chat_messages: the transcript, visitor and assistant turns, with
--    mock and flagged markers (prompt injection, pricing and so on).
-- 3. growth_settings: chat_widget_enabled (default false), chat_max_messages,
--    chat_max_conversations_per_ip_per_day, chat_consent_text,
--    lead_alert_email.
-- 4. growth_leads: a unique index so each valuation tool lead is linked to at
--    most one Growth lead (source 'tool', source_ref the tool lead id).
--
-- ACCESS
-- As 083 to 089: RLS on with no policies, every privilege revoked from anon
-- and authenticated. The public chat route uses the service role on the server.

BEGIN;

CREATE TABLE IF NOT EXISTS growth_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_test BOOLEAN NOT NULL DEFAULT false,
  is_mock BOOLEAN NOT NULL DEFAULT false,

  -- The visitor's handle on the conversation: random, never shown in the admin.
  access_token TEXT NOT NULL CHECK (length(access_token) >= 20),
  first_page TEXT,
  last_page TEXT,
  tracked_link_id UUID REFERENCES growth_tracked_links (id),

  lead_id UUID REFERENCES growth_leads (id),
  contact_id UUID REFERENCES growth_contacts (id),
  company_id UUID REFERENCES growth_companies (id),

  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'escalated')),
  route TEXT NOT NULL DEFAULT 'none' CHECK (route IN ('none', 'hot', 'warm', 'cold', 'escalated')),
  temperature TEXT CHECK (temperature IS NULL OR temperature IN ('hot', 'warm', 'cold')),
  score SMALLINT CHECK (score IS NULL OR score BETWEEN 0 AND 100),
  qualification JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(qualification) = 'object'),
  escalation_reason TEXT,
  alert_sent_at TIMESTAMPTZ,

  consent_given BOOLEAN NOT NULL DEFAULT false,
  consent_text TEXT,
  consent_at TIMESTAMPTZ,
  visitor_name TEXT,
  visitor_email TEXT CHECK (visitor_email IS NULL OR (visitor_email = lower(btrim(visitor_email)) AND position('@' IN visitor_email) > 1)),
  visitor_phone TEXT,
  visitor_company TEXT,
  nurture_opt_in BOOLEAN NOT NULL DEFAULT false,
  nurture_opt_in_at TIMESTAMPTZ,

  message_count INTEGER NOT NULL DEFAULT 0 CHECK (message_count >= 0),
  last_message_at TIMESTAMPTZ,
  ip_hash TEXT,
  user_agent TEXT CHECK (user_agent IS NULL OR length(user_agent) <= 300),

  CONSTRAINT growth_conversations_details_need_consent CHECK (
    consent_given OR (visitor_name IS NULL AND visitor_email IS NULL AND visitor_phone IS NULL AND visitor_company IS NULL)
  ),
  CONSTRAINT growth_conversations_consent_recorded CHECK (
    NOT consent_given OR (length(btrim(coalesce(consent_text, ''))) > 0 AND consent_at IS NOT NULL)
  ),
  CONSTRAINT growth_conversations_opt_in_needs_consent CHECK (NOT nurture_opt_in OR consent_given)
);

CREATE UNIQUE INDEX IF NOT EXISTS growth_conversations_token_key ON growth_conversations (access_token);
CREATE INDEX IF NOT EXISTS idx_growth_conversations_created ON growth_conversations (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_growth_conversations_ip ON growth_conversations (ip_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_growth_conversations_lead ON growth_conversations (lead_id);

DROP TRIGGER IF EXISTS growth_conversations_updated_at ON growth_conversations;
CREATE TRIGGER growth_conversations_updated_at BEFORE UPDATE ON growth_conversations
  FOR EACH ROW EXECUTE FUNCTION growth_set_updated_at();

CREATE TABLE IF NOT EXISTS growth_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  is_test BOOLEAN NOT NULL DEFAULT false,
  conversation_id UUID NOT NULL REFERENCES growth_conversations (id),
  role TEXT NOT NULL CHECK (role IN ('visitor', 'assistant', 'system')),
  content TEXT NOT NULL CHECK (length(content) BETWEEN 1 AND 4000),
  is_mock BOOLEAN NOT NULL DEFAULT false,
  usage_id UUID REFERENCES growth_ai_usage (id),
  -- Why the turn was handled specially: injection, pricing, legal, complaint, sensitive, limit, guard.
  flag TEXT
);

CREATE INDEX IF NOT EXISTS idx_growth_chat_messages_conversation ON growth_chat_messages (conversation_id, created_at);

ALTER TABLE growth_settings ADD COLUMN IF NOT EXISTS chat_widget_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE growth_settings ADD COLUMN IF NOT EXISTS chat_max_messages INTEGER NOT NULL DEFAULT 30;
ALTER TABLE growth_settings DROP CONSTRAINT IF EXISTS growth_settings_chat_max_messages_check;
ALTER TABLE growth_settings ADD CONSTRAINT growth_settings_chat_max_messages_check CHECK (chat_max_messages BETWEEN 4 AND 100);
ALTER TABLE growth_settings ADD COLUMN IF NOT EXISTS chat_max_conversations_per_ip_per_day INTEGER NOT NULL DEFAULT 5;
ALTER TABLE growth_settings DROP CONSTRAINT IF EXISTS growth_settings_chat_per_ip_check;
ALTER TABLE growth_settings ADD CONSTRAINT growth_settings_chat_per_ip_check CHECK (chat_max_conversations_per_ip_per_day BETWEEN 1 AND 100);
ALTER TABLE growth_settings ADD COLUMN IF NOT EXISTS chat_consent_text TEXT NOT NULL DEFAULT
  'I agree that PaceMakers may store my name and contact details with this conversation and contact me about my enquiry. I can ask for them to be deleted at any time.';
ALTER TABLE growth_settings DROP CONSTRAINT IF EXISTS growth_settings_chat_consent_text_check;
ALTER TABLE growth_settings ADD CONSTRAINT growth_settings_chat_consent_text_check CHECK (length(btrim(chat_consent_text)) BETWEEN 20 AND 1000);
ALTER TABLE growth_settings ADD COLUMN IF NOT EXISTS lead_alert_email TEXT NOT NULL DEFAULT 'ahmad.din@pacemakersglobal.com';
ALTER TABLE growth_settings DROP CONSTRAINT IF EXISTS growth_settings_lead_alert_email_check;
ALTER TABLE growth_settings ADD CONSTRAINT growth_settings_lead_alert_email_check CHECK (
  lead_alert_email = lower(btrim(lead_alert_email)) AND lead_alert_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
);

CREATE UNIQUE INDEX IF NOT EXISTS growth_leads_tool_lead_once ON growth_leads (source_ref) WHERE source = 'tool' AND NOT is_test AND source_ref IS NOT NULL;

ALTER TABLE growth_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth_chat_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE growth_conversations, growth_chat_messages FROM anon, authenticated;

COMMIT;
