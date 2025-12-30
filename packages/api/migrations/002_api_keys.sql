-- API Keys table
-- Stores hashed API keys for machine authentication
-- Keys are organization-scoped and can have different permission scopes

CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT 'Unnamed Key',
  scopes TEXT[] NOT NULL DEFAULT ARRAY['platform:read'],
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);

-- Index for fast lookup by key hash (primary auth lookup)
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash) WHERE is_active = true;

-- Index for listing keys by organization
CREATE INDEX IF NOT EXISTS idx_api_keys_org ON api_keys(org_id);

-- Index for cleanup of expired/revoked keys
CREATE INDEX IF NOT EXISTS idx_api_keys_cleanup ON api_keys(is_active, revoked_at) WHERE is_active = false;
