-- CLI Authentication Sessions
-- Enables browser-based authentication flow for CLI tools
-- Similar to Claude.ai / GitHub CLI device flow

-- CLI auth sessions track one-time authentication requests from CLI
CREATE TABLE cli_auth_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Session code: short user-facing code shown in browser URL
  session_code VARCHAR(32) NOT NULL UNIQUE,

  -- Device code: longer code that CLI uses to poll for completion
  device_code VARCHAR(64) NOT NULL UNIQUE,

  -- Session state
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'authorized', 'completed', 'expired', 'cancelled')),

  -- CLI metadata (for display in browser)
  cli_name VARCHAR(100) NOT NULL DEFAULT 'Agentics CLI',
  cli_version VARCHAR(20),
  hostname VARCHAR(255),
  ip_address INET,
  user_agent TEXT,

  -- User who authorized (set when status changes to 'authorized')
  authorized_user_id UUID,
  authorized_org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

  -- API key created for this session (set when status changes to 'completed')
  api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '10 minutes'),
  authorized_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Scopes requested by CLI (default read-only)
  requested_scopes TEXT[] NOT NULL DEFAULT ARRAY['platform:read'],

  -- Temporary storage for plaintext API key (cleared after CLI retrieves it)
  -- This is only stored temporarily between authorization and CLI polling
  api_key_plaintext TEXT
);

-- Index for fast session code lookup (browser URL)
CREATE INDEX idx_cli_auth_sessions_session_code ON cli_auth_sessions(session_code);

-- Index for fast device code lookup (CLI polling)
CREATE INDEX idx_cli_auth_sessions_device_code ON cli_auth_sessions(device_code);

-- Index for cleanup of expired sessions
CREATE INDEX idx_cli_auth_sessions_expires_at ON cli_auth_sessions(expires_at);

-- Index for user audit trail
CREATE INDEX idx_cli_auth_sessions_authorized_user ON cli_auth_sessions(authorized_user_id);

-- Cleanup function for expired sessions (run periodically)
-- In production, schedule this with pg_cron or application-level job
CREATE OR REPLACE FUNCTION cleanup_expired_cli_auth_sessions()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM cli_auth_sessions
  WHERE status = 'pending' AND expires_at < now();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE cli_auth_sessions IS 'Tracks CLI authentication sessions for browser-based auth flow';
COMMENT ON COLUMN cli_auth_sessions.session_code IS 'Short code displayed in browser URL for user verification';
COMMENT ON COLUMN cli_auth_sessions.device_code IS 'Secret code used by CLI to poll for session completion';
COMMENT ON COLUMN cli_auth_sessions.status IS 'Session lifecycle: pending -> authorized -> completed (or expired/cancelled)';
