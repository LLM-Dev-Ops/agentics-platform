/**
 * Billing Handlers
 *
 * HTTP handlers for billing and subscription management endpoints.
 * NOTE: These are scaffold endpoints for MVP - actual billing enforcement is deferred.
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { entitlementService, billingService } from '../services/entitlements/index.js';
import { Tier, isValidTier } from '../services/entitlements/tiers.js';
import Stripe from 'stripe';

/**
 * Request types
 */
interface AuthenticatedRequest extends FastifyRequest {
  user?: {
    userId: string;
    email?: string;
    name?: string;
    identityId?: string;
    scopes?: string[];
  };
}

interface CheckoutSessionBody {
  tier: Tier;
  successUrl: string;
  cancelUrl: string;
}

interface BillingPortalQuery {
  returnUrl: string;
}

/**
 * POST /v1/billing/checkout
 *
 * Create a Stripe checkout session for upgrading to a paid tier
 */
export async function createCheckoutSessionHandler(
  request: FastifyRequest<{ Body: CheckoutSessionBody }>,
  reply: FastifyReply
) {
  const authRequest = request as AuthenticatedRequest;

  // Check authentication
  if (!authRequest.user?.userId) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Authentication required',
    });
  }

  // Check if billing is enabled
  if (!billingService.isEnabled()) {
    return reply.status(503).send({
      error: 'Service Unavailable',
      message: 'Billing is not configured (MVP mode)',
    });
  }

  const { tier, successUrl, cancelUrl } = request.body;

  // Validate tier
  if (!tier || !isValidTier(tier)) {
    return reply.status(400).send({
      error: 'Bad Request',
      message: 'Invalid tier. Must be one of: DEVELOPER, TEAM, ENTERPRISE',
    });
  }

  if (tier === 'FREE') {
    return reply.status(400).send({
      error: 'Bad Request',
      message: 'Cannot create checkout session for FREE tier',
    });
  }

  // Validate URLs
  if (!successUrl || !cancelUrl) {
    return reply.status(400).send({
      error: 'Bad Request',
      message: 'Both successUrl and cancelUrl are required',
    });
  }

  try {
    const userId = authRequest.user.userId;
    const email = authRequest.user.email || `${userId}@example.com`;

    // Get or create Stripe customer
    const entitlement = await entitlementService.lookupEntitlements(userId);
    let customerId = entitlement.stripeCustomerId;

    if (!customerId) {
      customerId = await billingService.createCustomer(
        userId,
        email,
        authRequest.user.name
      );
    }

    // Create checkout session
    const sessionUrl = await billingService.createCheckoutSession(customerId, tier, {
      successUrl,
      cancelUrl,
      metadata: {
        userId,
      },
    });

    return reply.status(200).send({
      success: true,
      data: {
        sessionUrl,
        tier,
      },
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return reply.status(500).send({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to create checkout session',
    });
  }
}

/**
 * GET /v1/billing/portal
 *
 * Get Stripe billing portal URL for managing subscription
 */
export async function getBillingPortalHandler(
  request: FastifyRequest<{ Querystring: BillingPortalQuery }>,
  reply: FastifyReply
) {
  const authRequest = request as AuthenticatedRequest;

  // Check authentication
  if (!authRequest.user?.userId) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Authentication required',
    });
  }

  // Check if billing is enabled
  if (!billingService.isEnabled()) {
    return reply.status(503).send({
      error: 'Service Unavailable',
      message: 'Billing is not configured (MVP mode)',
    });
  }

  const { returnUrl } = request.query;

  if (!returnUrl) {
    return reply.status(400).send({
      error: 'Bad Request',
      message: 'returnUrl query parameter is required',
    });
  }

  try {
    const userId = authRequest.user.userId;

    // Get user entitlement
    const entitlement = await entitlementService.lookupEntitlements(userId);

    if (!entitlement.stripeCustomerId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'No billing account found for this user',
      });
    }

    // Get billing portal URL
    const portalUrl = await billingService.getBillingPortalUrl(
      entitlement.stripeCustomerId,
      returnUrl
    );

    return reply.status(200).send({
      success: true,
      data: {
        portalUrl,
      },
    });
  } catch (error) {
    console.error('Error getting billing portal URL:', error);
    return reply.status(500).send({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to get billing portal URL',
    });
  }
}

/**
 * POST /v1/billing/webhooks
 *
 * Stripe webhook endpoint for processing subscription events
 */
export async function handleStripeWebhookHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  // Check if billing is enabled
  if (!billingService.isEnabled()) {
    return reply.status(503).send({
      error: 'Service Unavailable',
      message: 'Billing is not configured (MVP mode)',
    });
  }

  const signature = request.headers['stripe-signature'] as string;

  if (!signature) {
    return reply.status(400).send({
      error: 'Bad Request',
      message: 'Missing stripe-signature header',
    });
  }

  try {
    // Verify webhook signature and construct event
    const payload = (request.body as any).toString();
    const event = billingService.verifyWebhookSignature(payload, signature);

    // Handle the event
    await billingService.handleWebhook(event);

    return reply.status(200).send({
      success: true,
      received: true,
    });
  } catch (error) {
    console.error('Webhook error:', error);

    if (error instanceof Error && error.message.includes('signature')) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Invalid webhook signature',
      });
    }

    return reply.status(500).send({
      error: 'Internal Server Error',
      message: 'Failed to process webhook',
    });
  }
}

/**
 * GET /v1/billing/subscription
 *
 * Get current subscription information for the authenticated user
 */
export async function getSubscriptionHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const authRequest = request as AuthenticatedRequest;

  // Check authentication
  if (!authRequest.user?.userId) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Authentication required',
    });
  }

  try {
    const userId = authRequest.user.userId;
    const entitlement = await entitlementService.lookupEntitlements(userId);

    // Get tier limits
    const limits = entitlementService.getTierLimits(entitlement.tier);

    // Build response
    const response: any = {
      success: true,
      data: {
        tier: entitlement.tier,
        status: entitlement.subscriptionStatus || 'active',
        limits: {
          requests: limits.requestsPerMonth,
          tokens: limits.tokensPerMonth,
          apiKeys: limits.maxApiKeys,
        },
        features: limits.features,
      },
    };

    // Add subscription details if available
    if (entitlement.stripeSubscriptionId && billingService.isEnabled()) {
      try {
        const subscriptionInfo = await billingService.getSubscriptionInfo(
          entitlement.stripeSubscriptionId
        );

        if (subscriptionInfo) {
          response.data.subscription = {
            id: subscriptionInfo.subscriptionId,
            status: subscriptionInfo.status,
            currentPeriodStart: subscriptionInfo.currentPeriodStart.toISOString(),
            currentPeriodEnd: subscriptionInfo.currentPeriodEnd.toISOString(),
            cancelAtPeriodEnd: subscriptionInfo.cancelAtPeriodEnd,
          };
        }
      } catch (error) {
        console.warn('Failed to fetch subscription info from Stripe:', error);
      }
    }

    return reply.status(200).send(response);
  } catch (error) {
    console.error('Error fetching subscription:', error);
    return reply.status(500).send({
      error: 'Internal Server Error',
      message: 'Failed to fetch subscription information',
    });
  }
}

/**
 * POST /v1/billing/cancel
 *
 * Cancel the user's subscription
 */
export async function cancelSubscriptionHandler(
  request: FastifyRequest<{ Body: { immediately?: boolean } }>,
  reply: FastifyReply
) {
  const authRequest = request as AuthenticatedRequest;

  // Check authentication
  if (!authRequest.user?.userId) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Authentication required',
    });
  }

  // Check if billing is enabled
  if (!billingService.isEnabled()) {
    return reply.status(503).send({
      error: 'Service Unavailable',
      message: 'Billing is not configured (MVP mode)',
    });
  }

  try {
    const userId = authRequest.user.userId;
    const { immediately = false } = request.body || {};

    const entitlement = await entitlementService.lookupEntitlements(userId);

    if (!entitlement.stripeSubscriptionId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'No active subscription found',
      });
    }

    // Cancel subscription
    await billingService.cancelSubscription(entitlement.stripeSubscriptionId, immediately);

    return reply.status(200).send({
      success: true,
      data: {
        message: immediately
          ? 'Subscription canceled immediately'
          : 'Subscription will be canceled at the end of the billing period',
      },
    });
  } catch (error) {
    console.error('Error canceling subscription:', error);
    return reply.status(500).send({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to cancel subscription',
    });
  }
}
