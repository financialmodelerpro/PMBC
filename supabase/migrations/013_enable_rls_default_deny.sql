-- 013_enable_rls_default_deny.sql
-- Resolves the 10 RLS-disabled errors flagged by Supabase's Security Advisor
-- on every public-schema table.
--
-- Strategy: enable RLS on every table and create NO policies. Postgres treats
-- "RLS enabled with no policies" as default-deny for every role except
-- BYPASSRLS roles. Supabase's `service_role` has BYPASSRLS, so all server-side
-- queries that go through createSupabaseServerClient() (which uses the
-- service-role key) continue to work exactly as before.
--
-- The anon key is locked out entirely: any client-side query against these
-- tables using NEXT_PUBLIC_SUPABASE_ANON_KEY would now return zero rows /
-- silently no-op writes. PMBC does not currently use the anon key for any
-- table reads (the only browser-facing flow, the contact form, POSTs JSON to
-- /api/contact, which executes server-side via the service role). A
-- createSupabaseBrowserClient() helper exists in src/lib/supabase/client.ts
-- but has no call sites in the codebase. So this migration does not break any
-- existing flow.
--
-- Idempotent: ALTER TABLE ... ENABLE ROW LEVEL SECURITY is a no-op when RLS
-- is already on.

BEGIN;

ALTER TABLE admin_users          ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log            ENABLE ROW LEVEL SECURITY;
ALTER TABLE cms_content          ENABLE ROW LEVEL SECURITY;
ALTER TABLE cms_pages            ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_sections        ENABLE ROW LEVEL SECURITY;
ALTER TABLE branding_config      ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_submissions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_branding       ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates      ENABLE ROW LEVEL SECURITY;

COMMIT;
