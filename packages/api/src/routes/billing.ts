/**
 * Billing Routes
 *
 * Defines routes for billing and subscription management endpoints.
 * Requires authentication.
 */

import { FastifyInstance } from 'fastify';
import {
  createCheckoutSessionHandler,
  getBillingPortalHandler,
  handleStripeWebhookHandler,
  getSubscriptionHandler,
  cancelSubscriptionHandler,
} from '../handlers/billing.js';

/**
 * Register billing routes
 */
export async function registerBillingRoutes(fastify: FastifyInstance) {
  /**
   * POST /v1/billing/checkout
   * Create a Stripe checkout session for upgrading to a paid tier
   *
   * Body:
   * - tier: 'DEVELOPER' | 'TEAM' | 'ENTERPRISE'
   * - successUrl: string
   * - cancelUrl: string
   *
   * Requires: authentication
   */
  fastify.post('/v1/billing/checkout', createCheckoutSessionHandler);

  /**
   * GET /v1/billing/portal
   * Get Stripe billing portal URL for managing subscription
   *
   * Query params:
   * - returnUrl: string
   *
   * Requires: authentication
   */
  fastify.get('/v1/billing/portal', getBillingPortalHandler);

  /**
   * POST /v1/billing/webhooks
   * Stripe webhook endpoint for processing subscription events
   *
   * NOTE: No authentication required - verified via Stripe signature
   * NOTE: Requires raw body parsing for signature verification
   */
  fastify.post(
    '/v1/billing/webhooks',
    {
      config: {
        rawBody: true,
      },
    },
    handleStripeWebhookHandler
  );

  /**
   * GET /v1/billing/subscription
   * Get current subscription information for the authenticated user
   *
   * Requires: authentication
   */
  fastify.get('/v1/billing/subscription', getSubscriptionHandler);

  /**
   * POST /v1/billing/cancel
   * Cancel the user's subscription
   *
   * Body:
   * - immediately: boolean (optional, default: false)
   *
   * Requires: authentication
   */
  fastify.post('/v1/billing/cancel', cancelSubscriptionHandler);
}
