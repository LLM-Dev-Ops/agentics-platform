-- Enterprise Gate Schema
-- Adds binary enterprise entitlement flag and Stripe customer mapping
-- This is CORE INFRASTRUCTURE - do not modify

-- Add enterprise flag and Stripe customer mapping to organizations
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS is_enterprise BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT UNIQUE;

-- Index for enterprise lookup (used by middleware on every request)
CREATE INDEX IF NOT EXISTS idx_organizations_enterprise
  ON organizations(id) WHERE is_enterprise = true;

-- Index for Stripe customer lookup (used by webhook handler)
CREATE INDEX IF NOT EXISTS idx_organizations_stripe_customer
  ON organizations(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

-- Webhook event idempotency log
-- Prevents duplicate processing of Stripe events
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  org_id UUID REFERENCES organizations(id),
  result TEXT NOT NULL -- 'success' | 'error' | 'ignored'
);

-- Index for cleanup of old events (retain 30 days)
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed
  ON stripe_webhook_events(processed_at);

-- Comments for documentation
COMMENT ON COLUMN organizations.is_enterprise IS 'Binary enterprise flag - controlled exclusively by Stripe webhooks';
COMMENT ON COLUMN organizations.stripe_customer_id IS 'Stripe customer ID for webhook event mapping';
COMMENT ON TABLE stripe_webhook_events IS 'Idempotency log for Stripe webhook processing';
