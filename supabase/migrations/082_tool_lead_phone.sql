-- 082_tool_lead_phone.sql
--
-- DDL, HAND-RUN in the Supabase SQL editor (supabase-js cannot run ALTER TABLE).
--
-- SAFE TO APPLY: any time, before or after the deploy that uses it. It only adds
-- nullable columns and an index. Until it is applied, the lead route saves the
-- lead without the phone number and country (it retries the insert without
-- them) and the admin shows "Not given", so nothing breaks in the gap. After it
-- is applied, leads saved from then on carry both.
--
-- What it is for (2026-09-21):
--   1. phone: the phone number with country code, asked on the name and email
--      step of the free tools, shown in the admin and the internal alert email.
--      Optional, stored as the visitor typed it after cleaning (digits, spaces,
--      a leading plus), never validated against a carrier.
--   2. contact_country: the country the person selects on the same step, which
--      also sets the phone number's country code. Separate from `country`, which
--      is the country of the business being valued.
--   3. idx_tool_leads_email_lower: the admin groups leads by email (one person,
--      many valuations), matching case-insensitively. The index keeps that
--      lookup fast as the table grows.

ALTER TABLE tool_leads ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE tool_leads ADD COLUMN IF NOT EXISTS contact_country TEXT;

CREATE INDEX IF NOT EXISTS idx_tool_leads_email_lower ON tool_leads (lower(email));
