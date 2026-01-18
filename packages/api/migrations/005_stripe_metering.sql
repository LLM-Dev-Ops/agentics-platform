-- Stripe Metering Status
-- Adds visibility into whether Stripe metering is active for an organization
-- Read-only status field - no billing UI exposure

-- Add stripe_metering_enabled flag to organizations
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS stripe_metering_enabled BOOLEAN NOT NULL DEFAULT false;

-- Comment for documentation
COMMENT ON COLUMN organizations.stripe_metering_enabled IS 'Read-only flag indicating if Stripe usage metering is active for this organization';
