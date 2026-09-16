-- 076_tool_visibility.sql
-- Per-tool visibility for the free tools: Hidden or Live.
--
-- SAFE TO APPLY: any time, before or after the free tools code is deployed.
--   Before the deploy nothing reads it. After the deploy, until it is applied,
--   the code treats every tool as Hidden and /admin/tools says the migration is
--   missing. Seeds every ready tool as `hidden`, so applying it never makes
--   anything public.
--
-- DDL. Paste into the Supabase SQL editor by hand, like 031 to 033 and 072:
-- supabase-js cannot run CREATE TABLE and this repository has no direct
-- Postgres connection string.
--
-- WHAT IT HOLDS
-- One row per tool, keyed by the registry slug in src/config/tools.ts. The
-- registry decides which tools exist and whether each is built; this table
-- decides only whether a built tool is public. A missing row means Hidden, so a
-- new tool added to the registry is Hidden until someone switches it on.
--
-- Who changed it and when is kept on the row for the list screen, and in full
-- in audit_log (action `tool_visibility`), which is where the history lives.
--
-- RLS on with no policies, like every other table since 013: only the service
-- role, which the server uses, can read or write it.
--
-- Idempotent.

BEGIN;

CREATE TABLE IF NOT EXISTS tool_visibility (
  slug TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'hidden' CHECK (status IN ('hidden', 'live')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES admin_users(id)
);

ALTER TABLE tool_visibility ENABLE ROW LEVEL SECURITY;

INSERT INTO tool_visibility (slug, status)
VALUES ('business-valuation', 'hidden')
ON CONFLICT (slug) DO NOTHING;

COMMIT;
