/**
 * ERP Surface Reference Type Definitions
 *
 * This module defines types for referencing ERP surfaces from simulations
 * and deployment intents. These are the contracts that connect the abstract
 * ERP surface definitions to concrete simulation/deployment use cases.
 *
 * IMPORTANT: This is a contract-definition module. It contains ONLY type
 * definitions and no executable code. See architecture/FORBIDDEN_PATHS.md
 * for Integration Surface constraints.
 */

import type { ERPDomain } from './domains.js';
import type { ERPEventCategory } from './events.js';

/**
 * Reference to an ERP capability from a simulation specification.
 */
export interface ERPCapabilityReference {
  /** Referenced capability ID */
  capabilityId: string;
  /** Referenced domain */
  domain: ERPDomain;
  /** Optional subdomain */
  subdomain?: string;
  /** Reference context (why this capability is referenced) */
  context?: string;
  /** Whether this reference is required or optional */
  required?: boolean;
  /** Version constraint (semver range) */
  versionConstraint?: string;
}

/**
 * Reference to an ERP event from a simulation specification.
 */
export interface ERPEventReference {
  /** Referenced event ID */
  eventId: string;
  /** Domain the event belongs to */
  domain: ERPDomain;
  /** Event category */
  category: ERPEventCategory;
  /** Reference context */
  context?: string;
  /** Expected event count in simulation */
  expectedCount?: {
    min?: number;
    max?: number;
  };
}

/**
 * Simulation-to-ERP surface reference.
 * Declares what ERP capabilities and events a simulation uses.
 */
export interface SimulationERPReference {
  /** Unique reference identifier */
  id: string;
  /** Simulation specification ID that references ERP */
  simulationId: string;
  /** Simulation name/description */
  simulationName?: string;
  /** Referenced capabilities */
  capabilities: ERPCapabilityReference[];
  /** Referenced events */
  events: ERPEventReference[];
  /** Reference metadata */
  metadata?: {
    /** When this reference was created */
    createdAt?: string;
    /** Reference version */
    version?: string;
    /** Notes about the reference */
    notes?: string;
  };
}

/**
 * Deployment intent ERP reference.
 * Declares what ERP capabilities a deployment intent targets.
 */
export interface DeploymentIntentERPReference {
  /** Unique reference identifier */
  id: string;
  /** Deployment intent ID */
  intentId: string;
  /** Intent type */
  intentType: 'deployment' | 'configuration' | 'migration' | 'rollback';
  /** Target environment */
  targetEnvironment: string;
  /** Referenced capabilities */
  capabilities: ERPCapabilityReference[];
  /** Validation status */
  validationStatus?: 'pending' | 'valid' | 'invalid';
  /** Validation errors if any */
  validationErrors?: string[];
  /** Reference metadata */
  metadata?: {
    /** When this reference was created */
    createdAt?: string;
    /** When validation was last performed */
    validatedAt?: string;
    /** Submitter information */
    submitter?: string;
  };
}

/**
 * ERP reference index aggregating all references.
 */
export interface ERPReferenceIndex {
  /** Index version */
  version: string;
  /** Last updated timestamp (ISO 8601) */
  lastUpdated: string;
  /** All simulation references */
  simulationReferences: SimulationERPReference[];
  /** All deployment intent references */
  deploymentIntentReferences: DeploymentIntentERPReference[];
  /** Summary statistics */
  summary?: {
    /** Total simulation references */
    totalSimulations: number;
    /** Total deployment intents */
    totalIntents: number;
    /** Most referenced domains */
    topDomains: { domain: ERPDomain; count: number }[];
    /** Most referenced capabilities */
    topCapabilities: { capabilityId: string; count: number }[];
  };
}
