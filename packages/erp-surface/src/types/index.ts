/**
 * ERP Surface Type Definitions
 *
 * This module exports all ERP surface contract types.
 *
 * IMPORTANT: This package (erp-surface) is an Integration Surface repository.
 * It contains ONLY contract definitions - no executable code, no infrastructure,
 * and no adapter implementations. See architecture/FORBIDDEN_PATHS.md.
 */

// Domain types
export {
  ERPDomain,
  type ERPSubdomain,
  type ERPCapability,
  type ERPDomainManifest,
  type ERPSurfaceManifest,
} from './domains.js';

// Event types
export {
  ERPEventCategory,
  type ERPEventDirection,
  type ERPEventDelivery,
  type ERPEventPriority,
  type ERPEvent,
  type ERPEventSubscription,
  type ERPEventManifest,
} from './events.js';

// Reference types
export type {
  ERPCapabilityReference,
  ERPEventReference,
  SimulationERPReference,
  DeploymentIntentERPReference,
  ERPReferenceIndex,
} from './references.js';
