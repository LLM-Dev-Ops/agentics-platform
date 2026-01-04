/**
 * ERP Event Type Definitions
 *
 * This module defines the canonical ERP event types that can be
 * referenced in simulation specifications and deployment intents.
 *
 * IMPORTANT: This is a contract-definition module. It contains ONLY type
 * definitions and no executable code. See architecture/FORBIDDEN_PATHS.md
 * for Integration Surface constraints.
 */

import type { ERPDomain } from './domains.js';

/**
 * Event direction indicating whether an event flows into or out of the ERP.
 */
export type ERPEventDirection = 'inbound' | 'outbound';

/**
 * Event delivery semantics.
 */
export type ERPEventDelivery = 'at-least-once' | 'at-most-once' | 'exactly-once';

/**
 * Event priority levels.
 */
export type ERPEventPriority = 'low' | 'normal' | 'high' | 'critical';

/**
 * ERP event category for high-level classification.
 */
export enum ERPEventCategory {
  /** Data creation events */
  CREATE = 'CREATE',
  /** Data modification events */
  UPDATE = 'UPDATE',
  /** Data deletion events */
  DELETE = 'DELETE',
  /** State transition events */
  STATE_CHANGE = 'STATE_CHANGE',
  /** Business process events */
  PROCESS = 'PROCESS',
  /** Integration/sync events */
  SYNC = 'SYNC',
  /** Notification/alert events */
  NOTIFICATION = 'NOTIFICATION',
}

/**
 * ERP event definition.
 * Represents a business event that can occur in or be sent to an ERP system.
 */
export interface ERPEvent {
  /** Unique event type identifier */
  id: string;
  /** Human-readable event name */
  name: string;
  /** Event category */
  category: ERPEventCategory;
  /** Domain this event relates to */
  domain: ERPDomain;
  /** Event direction */
  direction: ERPEventDirection;
  /** Detailed description */
  description: string;
  /** Event schema version */
  version: string;
  /** Delivery semantics */
  delivery?: ERPEventDelivery;
  /** Default priority */
  priority?: ERPEventPriority;
  /** Whether this event is deprecated */
  deprecated?: boolean;
  /** Payload schema reference (JSON Schema $id) */
  payloadSchemaRef?: string;
  /** Example payload (for documentation) */
  examplePayload?: Record<string, unknown>;
  /** Tags for categorization */
  tags?: string[];
  /** Related events (e.g., inverse operations) */
  relatedEvents?: string[];
}

/**
 * Event subscription contract.
 * Defines how a consumer can subscribe to events.
 */
export interface ERPEventSubscription {
  /** Subscription identifier */
  id: string;
  /** Events included in this subscription */
  eventIds: string[];
  /** Filter criteria for events */
  filters?: {
    /** Filter by domain */
    domains?: ERPDomain[];
    /** Filter by category */
    categories?: ERPEventCategory[];
    /** Filter by priority */
    minPriority?: ERPEventPriority;
    /** Custom filter expression */
    expression?: string;
  };
  /** Delivery configuration */
  delivery: {
    /** Delivery semantics */
    semantics: ERPEventDelivery;
    /** Retry policy */
    retry?: {
      maxAttempts: number;
      backoffMultiplier: number;
    };
  };
}

/**
 * Event manifest containing all events for the ERP surface.
 */
export interface ERPEventManifest {
  /** Manifest version */
  version: string;
  /** Last updated timestamp (ISO 8601) */
  lastUpdated: string;
  /** All event definitions */
  events: ERPEvent[];
  /** Subscription templates */
  subscriptionTemplates?: ERPEventSubscription[];
  /** Event metadata */
  metadata?: {
    /** Total event count by direction */
    counts?: {
      inbound: number;
      outbound: number;
    };
    /** Maintainer information */
    maintainer?: string;
  };
}
