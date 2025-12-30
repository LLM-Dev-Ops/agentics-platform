/**
 * Enterprise Gate Handler
 *
 * Stripe webhook handler that controls the binary enterprise entitlement flag.
 * This is CORE INFRASTRUCTURE - do not modify behavior.
 *
 * Processes exactly 3 Stripe events:
 * 1. checkout.session.completed → is_enterprise = true
 * 2. customer.subscription.deleted → is_enterprise = false
 * 3. invoice.payment_failed → is_enterprise = false
 *
 * Properties:
 * - Binary: is_enterprise is true or false, nothing else
 * - Authoritative: Stripe events are the only source of truth
 * - Idempotent: Events are logged and deduplicated
 * - Secure: Verified using Stripe webhook signing secret
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import Stripe from 'stripe';
import { db } from '../db.js';
import config from '../config.js';

// ============================================================================
// STRIPE CLIENT
// ============================================================================

let stripe: Stripe | null = null;

function getStripeClient(): Stripe {
  if (!stripe) {
    if (!config.stripe.secretKey) {
      throw new Error('STRIPE_SECRET_KEY not configured');
    }
    stripe = new Stripe(config.stripe.secretKey, {
      apiVersion: '2023-10-16',
    });
  }
  return stripe;
}

// ============================================================================
// WEBHOOK HANDLER
// ============================================================================

/**
 * POST /v1/enterprise/webhook
 *
 * Dedicated Stripe webhook endpoint for enterprise gate control.
 * Separate from general billing webhooks for isolation and clarity.
 */
export async function handleEnterpriseWebhook(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Verify Stripe is configured
  if (!config.stripe.secretKey || !config.stripe.webhookSecret) {
    reply.status(503).send({
      error: 'Service Unavailable',
      code: 'STRIPE_NOT_CONFIGURED',
    });
    return;
  }

  // Get signature header
  const signature = request.headers['stripe-signature'] as string;
  if (!signature) {
    reply.status(400).send({
      error: 'Bad Request',
      code: 'MISSING_SIGNATURE',
    });
    return;
  }

  // Verify webhook signature
  let event: Stripe.Event;
  try {
    // Raw body is provided by fastify-raw-body plugin when config.rawBody is true
    const payload = (request as unknown as { rawBody: string }).rawBody;
    if (!payload) {
      reply.status(400).send({
        error: 'Bad Request',
        code: 'MISSING_RAW_BODY',
      });
      return;
    }
    event = getStripeClient().webhooks.constructEvent(
      payload,
      signature,
      config.stripe.webhookSecret
    );
  } catch (err) {
    reply.status(400).send({
      error: 'Bad Request',
      code: 'INVALID_SIGNATURE',
    });
    return;
  }

  // Check for duplicate event (idempotency)
  const isDuplicate = await checkEventProcessed(event.id);
  if (isDuplicate) {
    reply.status(200).send({ received: true, duplicate: true });
    return;
  }

  // Process event
  let result: 'success' | 'error' | 'ignored' = 'ignored';
  let orgId: string | null = null;

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        const checkoutResult = await handleCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session
        );
        result = checkoutResult.success ? 'success' : 'error';
        orgId = checkoutResult.orgId;
        break;

      case 'customer.subscription.deleted':
        const deletedResult = await handleSubscriptionDeleted(
          event.data.object as Stripe.Subscription
        );
        result = deletedResult.success ? 'success' : 'error';
        orgId = deletedResult.orgId;
        break;

      case 'invoice.payment_failed':
        const failedResult = await handlePaymentFailed(
          event.data.object as Stripe.Invoice
        );
        result = failedResult.success ? 'success' : 'error';
        orgId = failedResult.orgId;
        break;

      default:
        // Ignore all other events
        result = 'ignored';
    }

    // Log event for idempotency
    await logEventProcessed(event.id, event.type, orgId, result);

    reply.status(200).send({ received: true, result });
  } catch (err) {
    // Log error event
    await logEventProcessed(event.id, event.type, orgId, 'error');
    throw err;
  }
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

interface EventResult {
  success: boolean;
  orgId: string | null;
}

/**
 * Handle checkout.session.completed
 * Mark organization as enterprise when checkout succeeds
 */
async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session
): Promise<EventResult> {
  const customerId = session.customer as string;

  if (!customerId) {
    return { success: false, orgId: null };
  }

  // Find organization by Stripe customer ID
  const org = await findOrgByStripeCustomer(customerId);

  if (!org) {
    // Customer not mapped to org yet - create mapping from metadata
    const userId = session.metadata?.userId || session.client_reference_id;
    if (userId) {
      const orgId = await mapStripeCustomerToOrg(customerId, userId);
      if (orgId) {
        await setEnterpriseStatus(orgId, true);
        return { success: true, orgId };
      }
    }
    return { success: false, orgId: null };
  }

  // Set enterprise flag
  await setEnterpriseStatus(org.id, true);
  return { success: true, orgId: org.id };
}

/**
 * Handle customer.subscription.deleted
 * Immediately revoke enterprise access when subscription is deleted
 */
async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription
): Promise<EventResult> {
  const customerId = subscription.customer as string;

  if (!customerId) {
    return { success: false, orgId: null };
  }

  const org = await findOrgByStripeCustomer(customerId);
  if (!org) {
    return { success: false, orgId: null };
  }

  // Revoke enterprise access immediately
  await setEnterpriseStatus(org.id, false);
  return { success: true, orgId: org.id };
}

/**
 * Handle invoice.payment_failed
 * Immediately revoke enterprise access when payment fails
 */
async function handlePaymentFailed(
  invoice: Stripe.Invoice
): Promise<EventResult> {
  const customerId = invoice.customer as string;

  if (!customerId) {
    return { success: false, orgId: null };
  }

  const org = await findOrgByStripeCustomer(customerId);
  if (!org) {
    return { success: false, orgId: null };
  }

  // Revoke enterprise access immediately
  await setEnterpriseStatus(org.id, false);
  return { success: true, orgId: org.id };
}

// ============================================================================
// DATABASE OPERATIONS
// ============================================================================

interface OrgRecord {
  id: string;
  is_enterprise: boolean;
}

/**
 * Find organization by Stripe customer ID
 */
async function findOrgByStripeCustomer(
  stripeCustomerId: string
): Promise<OrgRecord | null> {
  try {
    const result = await db.query(
      `SELECT id, is_enterprise FROM organizations WHERE stripe_customer_id = $1`,
      [stripeCustomerId]
    );
    return result.rows[0] || null;
  } catch {
    return null;
  }
}

/**
 * Map Stripe customer to organization via user ID
 */
async function mapStripeCustomerToOrg(
  stripeCustomerId: string,
  userId: string
): Promise<string | null> {
  try {
    const result = await db.query(
      `UPDATE organizations
       SET stripe_customer_id = $1
       WHERE owner_user_id = $2
       RETURNING id`,
      [stripeCustomerId, userId]
    );
    return result.rows[0]?.id || null;
  } catch {
    return null;
  }
}

/**
 * Set enterprise status for organization
 * This is the only function that modifies is_enterprise
 */
async function setEnterpriseStatus(
  orgId: string,
  isEnterprise: boolean
): Promise<void> {
  await db.query(
    `UPDATE organizations SET is_enterprise = $1 WHERE id = $2`,
    [isEnterprise, orgId]
  );
}

/**
 * Check if event has already been processed (idempotency)
 */
async function checkEventProcessed(eventId: string): Promise<boolean> {
  try {
    const result = await db.query(
      `SELECT 1 FROM stripe_webhook_events WHERE event_id = $1`,
      [eventId]
    );
    return result.rows.length > 0;
  } catch {
    // Table may not exist yet - allow processing
    return false;
  }
}

/**
 * Log processed event for idempotency
 */
async function logEventProcessed(
  eventId: string,
  eventType: string,
  orgId: string | null,
  result: 'success' | 'error' | 'ignored'
): Promise<void> {
  try {
    await db.query(
      `INSERT INTO stripe_webhook_events (event_id, event_type, org_id, result)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (event_id) DO NOTHING`,
      [eventId, eventType, orgId, result]
    );
  } catch {
    // Ignore logging errors - don't fail the webhook
  }
}

// ============================================================================
// ENTERPRISE STATUS LOOKUP (for middleware)
// ============================================================================

/**
 * Check if organization is enterprise
 * Used by enterprise boundary middleware
 */
export async function isOrgEnterprise(orgId: string): Promise<boolean> {
  try {
    const result = await db.query(
      `SELECT is_enterprise FROM organizations WHERE id = $1`,
      [orgId]
    );
    return result.rows[0]?.is_enterprise === true;
  } catch {
    // On error, fail closed (not enterprise)
    return false;
  }
}
