-- 095_growth_chat_opening.sql
-- Growth Engine website chat opening behaviour (2026-09-23): whether the chat
-- opens by itself once per session, after how many seconds, and at what share
-- of the page scrolled, whichever comes first.
--
-- DDL, HAND-RUN in the Supabase SQL editor (supabase-js cannot run DDL).
--
-- SAFE TO APPLY: any time after 090, before or after the deploy that reads
-- these columns. It adds three settings columns with defaults (on, 20 seconds,
-- 50 per cent) and changes nothing visible: the chat itself stays off until
-- chat_widget_enabled is switched on, and while it is off nothing is added to
-- any page. Until it is applied the widget uses the same defaults and the
-- three settings cannot be saved.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS, and each check is dropped before it
-- is added.

BEGIN;

ALTER TABLE growth_settings ADD COLUMN IF NOT EXISTS chat_auto_open BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE growth_settings ADD COLUMN IF NOT EXISTS chat_auto_open_delay_seconds INTEGER NOT NULL DEFAULT 20;
ALTER TABLE growth_settings DROP CONSTRAINT IF EXISTS growth_settings_chat_auto_open_delay_check;
ALTER TABLE growth_settings ADD CONSTRAINT growth_settings_chat_auto_open_delay_check CHECK (chat_auto_open_delay_seconds BETWEEN 5 AND 300);
ALTER TABLE growth_settings ADD COLUMN IF NOT EXISTS chat_auto_open_scroll_percent INTEGER NOT NULL DEFAULT 50;
ALTER TABLE growth_settings DROP CONSTRAINT IF EXISTS growth_settings_chat_auto_open_scroll_check;
ALTER TABLE growth_settings ADD CONSTRAINT growth_settings_chat_auto_open_scroll_check CHECK (chat_auto_open_scroll_percent BETWEEN 10 AND 100);

COMMIT;
