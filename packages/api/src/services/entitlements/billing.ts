/**
 * Billing Service
 *
 * Stripe integration scaffold for subscription management.
 * NOTE: Actual billing enforcement is deferred for MVP - this is scaffold only.
 */

import Stripe from 'stripe';
import { entitlementStore } from './store.js';
import { Tier, isValidTier } from './tiers.js';

// Stripe price IDs (to be configured via environment variables)
const STRIPE_PRICE_IDS: Record<Tier, string> = {
  FREE: '', // Free tier has no Stripe price
  DEVELOPER: process.env.STRIPE_DEVELOPER_PRICE_ID || 'price_developer_placeholder',
  TEAM: process.env.STRIPE_TEAM_PRICE_ID || 'price_team_placeholder',
  ENTERPRISE: process.env.STRIPE_ENTERPRISE_PRICE_ID || 'price_enterprise_placeholder',
};

export interface CheckoutSessionOptions {
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}

export interface SubscriptionInfo {
  subscriptionId: string;
  customerId: string;
  status: 'active' | 'canceled' | 'past_due' | 'trialing' | 'paused';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  tier: Tier;
}

/**
 * BillingService - Handles Stripe integration for subscriptions
 */
export class BillingService {
  private stripe: Stripe | null = null;
  private enabled: boolean = false;

  constructor() {
    const apiKey = process.env.STRIPE_SECRET_KEY;
    if (apiKey && apiKey !== 'sk_test_placeholder') {
      this.stripe = new Stripe(apiKey, {
        apiVersion: '2023-10-16',
      });
      this.enabled = true;
    } else {
      console.warn('Stripe API key not configured - billing features disabled (MVP mode)');
      this.enabled = false;
    }
  }

  /**
   * Check if billing is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Create a Stripe customer for a user
   */
  async createCustomer(userId: string, email: string, name?: string): Promise<string> {
    if (!this.stripe) {
      throw new Error('Stripe not configured');
    }

    const customer = await this.stripe.customers.create({
      email,
      name,
      metadata: {
        userId,
      },
    });

    // Store customer ID in entitlements
    const entitlement = await entitlementStore.lookupUserEntitlement(userId);
    const tier = entitlement?.tier || 'FREE';

    await entitlementStore.storeUserEntitlement(userId, tier, {
      stripeCustomerId: customer.id,
    });

    return customer.id;
  }

  /**
   * Create a subscription for a customer
   */
  async createSubscription(customerId: string, tier: Tier): Promise<string> {
    if (!this.stripe) {
      throw new Error('Stripe not configured');
    }

    if (tier === 'FREE') {
      throw new Error('Cannot create subscription for FREE tier');
    }

    const priceId = STRIPE_PRICE_IDS[tier];
    if (!priceId || priceId.includes('placeholder')) {
      throw new Error(`Stripe price ID not configured for tier: ${tier}`);
    }

    const subscription = await this.stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      metadata: {
        tier,
      },
    });

    return subscription.id;
  }

  /**
   * Create a checkout session for upgrading/subscribing
   */
  async createCheckoutSession(
    customerId: string,
    tier: Tier,
    options: CheckoutSessionOptions
  ): Promise<string> {
    if (!this.stripe) {
      throw new Error('Stripe not configured');
    }

    if (tier === 'FREE') {
      throw new Error('Cannot create checkout session for FREE tier');
    }

    const priceId = STRIPE_PRICE_IDS[tier];
    if (!priceId || priceId.includes('placeholder')) {
      throw new Error(`Stripe price ID not configured for tier: ${tier}`);
    }

    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: options.successUrl,
      cancel_url: options.cancelUrl,
      metadata: {
        tier,
        ...options.metadata,
      },
    });

    if (!session.url) {
      throw new Error('Failed to create checkout session URL');
    }

    return session.url;
  }

  /**
   * Get billing portal URL for customer to manage subscription
   */
  async getBillingPortalUrl(customerId: string, returnUrl: string): Promise<string> {
    if (!this.stripe) {
      throw new Error('Stripe not configured');
    }

    const session = await this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return session.url;
  }

  /**
   * Get subscription info for a customer
   */
  async getSubscriptionInfo(subscriptionId: string): Promise<SubscriptionInfo | null> {
    if (!this.stripe) {
      throw new Error('Stripe not configured');
    }

    const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);

    if (!subscription) {
      return null;
    }

    const tier = (subscription.metadata?.tier as Tier) || 'FREE';

    return {
      subscriptionId: subscription.id,
      customerId: subscription.customer as string,
      status: subscription.status as SubscriptionInfo['status'],
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      tier,
    };
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(subscriptionId: string, immediately: boolean = false): Promise<void> {
    if (!this.stripe) {
      throw new Error('Stripe not configured');
    }

    if (immediately) {
      await this.stripe.subscriptions.cancel(subscriptionId);
    } else {
      await this.stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });
    }
  }

  /**
   * Handle Stripe webhook events
   */
  async handleWebhook(event: Stripe.Event): Promise<void> {
    console.log(`Processing Stripe webhook: ${event.type}`);

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_succeeded':
        await this.handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`Unhandled webhook event type: ${event.type}`);
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string | Buffer, signature: string): Stripe.Event {
    if (!this.stripe) {
      throw new Error('Stripe not configured');
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error('Stripe webhook secret not configured');
    }

    return this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  }

  /**
   * Handle subscription created/updated
   */
  private async handleSubscriptionUpdate(subscription: Stripe.Subscription): Promise<void> {
    const customerId = subscription.customer as string;
    const tier = (subscription.metadata?.tier as Tier) || 'DEVELOPER';

    if (!isValidTier(tier)) {
      console.error(`Invalid tier in subscription metadata: ${tier}`);
      return;
    }

    // Find user by customer ID
    const allEntitlements = await entitlementStore.getAllEntitlements();
    const userEntitlement = allEntitlements.find((e) => e.stripeCustomerId === customerId);

    if (!userEntitlement) {
      console.error(`No user found for Stripe customer: ${customerId}`);
      return;
    }

    // Update entitlement
    await entitlementStore.storeUserEntitlement(userEntitlement.userId, tier, {
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: subscription.status as any,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    });

    console.log(`Updated entitlement for user ${userEntitlement.userId} to tier ${tier}`);
  }

  /**
   * Handle subscription deleted
   */
  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    const customerId = subscription.customer as string;

    // Find user by customer ID
    const allEntitlements = await entitlementStore.getAllEntitlements();
    const userEntitlement = allEntitlements.find((e) => e.stripeCustomerId === customerId);

    if (!userEntitlement) {
      console.error(`No user found for Stripe customer: ${customerId}`);
      return;
    }

    // Downgrade to FREE tier
    await entitlementStore.storeUserEntitlement(userEntitlement.userId, 'FREE', {
      stripeCustomerId: customerId,
      stripeSubscriptionId: undefined,
      subscriptionStatus: 'canceled',
    });

    console.log(`Downgraded user ${userEntitlement.userId} to FREE tier (subscription canceled)`);
  }

  /**
   * Handle successful payment
   */
  private async handlePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    console.log(`Payment succeeded for invoice: ${invoice.id}`);
    // Additional logic can be added here (e.g., send receipt email)
  }

  /**
   * Handle failed payment
   */
  private async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    console.log(`Payment failed for invoice: ${invoice.id}`);
    // Additional logic can be added here (e.g., send notification)

    const customerId = invoice.customer as string;

    // Find user by customer ID
    const allEntitlements = await entitlementStore.getAllEntitlements();
    const userEntitlement = allEntitlements.find((e) => e.stripeCustomerId === customerId);

    if (!userEntitlement) {
      console.error(`No user found for Stripe customer: ${customerId}`);
      return;
    }

    // Update status to past_due
    await entitlementStore.storeUserEntitlement(userEntitlement.userId, userEntitlement.tier, {
      subscriptionStatus: 'past_due',
    });
  }
}

// Singleton instance for MVP
export const billingService = new BillingService();
