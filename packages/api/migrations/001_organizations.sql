-- Organizations table
-- Maps Supabase users to organizations
-- Each user owns one organization

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookup by owner
CREATE INDEX IF NOT EXISTS idx_organizations_owner ON organizations(owner_user_id);

-- Ensure api_keys references organizations
-- (Run only if api_keys table exists and needs the constraint)
-- ALTER TABLE api_keys ADD CONSTRAINT fk_api_keys_org
--   FOREIGN KEY (org_id) REFERENCES organizations(id);
