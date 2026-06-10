-- 023_team_members_collection.sql
-- Team and advisors as a managed collection (admin: /admin/team).
-- Public /team (and /about) render visible members ordered by display_order.

BEGIN;

CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT,
  photo TEXT,
  bio TEXT,
  credentials TEXT,
  linkedin_url TEXT,
  email TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_members_visible_order
  ON team_members(visible, display_order);

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

COMMIT;
