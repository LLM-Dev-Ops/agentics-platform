-- Add owner_email to organizations table
-- Stores the email address from Supabase JWT during CLI authorization
-- Used by /v1/auth/session to return email for API key holders

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS owner_email TEXT;

-- Index for internal email lookups
CREATE INDEX IF NOT EXISTS idx_organizations_email ON organizations(owner_email);
