/**
 * Enterprise Gate Routes
 *
 * Registers the dedicated Stripe webhook endpoint for enterprise gate control.
 * This is CORE INFRASTRUCTURE - do not modify.
 *
 * NOTE: No authentication required - verified via Stripe signature
 * NOTE: Requires raw body parsing for signature verification
 */

import { FastifyInstance } from 'fastify';
import { handleEnterpriseWebhook } from '../handlers/enterprise-gate.js';

/**
 * Register enterprise routes
 */
export async function registerEnterpriseRoutes(fastify: FastifyInstance) {
  /**
   * POST /v1/enterprise/webhook
   *
   * Dedicated Stripe webhook endpoint for enterprise gate control.
   * Processes exactly 3 events:
   * - checkout.session.completed → enable enterprise
   * - customer.subscription.deleted → revoke enterprise
   * - invoice.payment_failed → revoke enterprise
   *
   * NOTE: Separate from general billing webhooks for isolation
   * NOTE: Verified via Stripe webhook signing secret
   */
  fastify.post(
    '/v1/enterprise/webhook',
    {
      config: {
        rawBody: true,
      },
    },
    handleEnterpriseWebhook
  );
}
