/**
 * ERP Surface Types for Platform CLI
 *
 * This file provides type definitions from @agentics/erp-surface for use
 * in the platform CLI commands. In production, these would be imported
 * directly from the erp-surface package.
 *
 * IMPORTANT: These are contract types only - no executable logic.
 */

// Re-export domain types
export enum ERPDomain {
  FINANCE = 'FINANCE',
  HUMAN_RESOURCES = 'HUMAN_RESOURCES',
  SUPPLY_CHAIN = 'SUPPLY_CHAIN',
  CUSTOMER_RELATIONS = 'CUSTOMER_RELATIONS',
  MANUFACTURING = 'MANUFACTURING',
  PROCUREMENT = 'PROCUREMENT',
  INVENTORY = 'INVENTORY',
  PROJECT_MANAGEMENT = 'PROJECT_MANAGEMENT',
  SALES = 'SALES',
  ANALYTICS = 'ANALYTICS',
}

export interface ERPSubdomain {
  id: string;
  domain: ERPDomain;
  name: string;
  description: string;
  version: string;
}

export interface ERPCapability {
  id: string;
  domain: ERPDomain;
  subdomain?: string;
  name: string;
  description: string;
  version: string;
  deprecated?: boolean;
  inputSchemaRef?: string;
  outputSchemaRef?: string;
  tags?: string[];
}

export interface ERPDomainManifest {
  domain: ERPDomain;
  version: string;
  lastUpdated: string;
  subdomains: ERPSubdomain[];
  capabilities: ERPCapability[];
  metadata?: {
    maintainer?: string;
    documentationUrl?: string;
    stability?: 'experimental' | 'stable' | 'deprecated';
  };
}

// Event types
export enum ERPEventCategory {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  STATE_CHANGE = 'STATE_CHANGE',
  PROCESS = 'PROCESS',
  SYNC = 'SYNC',
  NOTIFICATION = 'NOTIFICATION',
}

export type ERPEventDirection = 'inbound' | 'outbound';
export type ERPEventDelivery = 'at-least-once' | 'at-most-once' | 'exactly-once';
export type ERPEventPriority = 'low' | 'normal' | 'high' | 'critical';

export interface ERPEvent {
  id: string;
  name: string;
  category: ERPEventCategory;
  domain: ERPDomain;
  direction: ERPEventDirection;
  description: string;
  version: string;
  delivery?: ERPEventDelivery;
  priority?: ERPEventPriority;
  deprecated?: boolean;
  payloadSchemaRef?: string;
  examplePayload?: Record<string, unknown>;
  tags?: string[];
  relatedEvents?: string[];
}

// Reference types
export interface ERPCapabilityReference {
  capabilityId: string;
  domain: ERPDomain;
  subdomain?: string;
  context?: string;
  required?: boolean;
  versionConstraint?: string;
}

export interface ERPEventReference {
  eventId: string;
  domain: ERPDomain;
  category: ERPEventCategory;
  context?: string;
  expectedCount?: {
    min?: number;
    max?: number;
  };
}

export interface SimulationERPReference {
  id: string;
  simulationId: string;
  simulationName?: string;
  capabilities: ERPCapabilityReference[];
  events: ERPEventReference[];
  metadata?: {
    createdAt?: string;
    version?: string;
    notes?: string;
  };
}

export interface DeploymentIntentERPReference {
  id: string;
  intentId: string;
  intentType: 'deployment' | 'configuration' | 'migration' | 'rollback';
  targetEnvironment: string;
  capabilities: ERPCapabilityReference[];
  validationStatus?: 'pending' | 'valid' | 'invalid';
  validationErrors?: string[];
  metadata?: {
    createdAt?: string;
    validatedAt?: string;
    submitter?: string;
  };
}

export interface ERPReferenceIndex {
  version: string;
  lastUpdated: string;
  simulationReferences: SimulationERPReference[];
  deploymentIntentReferences: DeploymentIntentERPReference[];
  summary?: {
    totalSimulations: number;
    totalIntents: number;
    topDomains: { domain: ERPDomain; count: number }[];
    topCapabilities: { capabilityId: string; count: number }[];
  };
}
