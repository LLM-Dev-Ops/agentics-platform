/**
 * ERP Capability Domain Type Definitions
 *
 * This module defines the canonical ERP capability domains that can be
 * referenced in simulation specifications and deployment intents.
 *
 * IMPORTANT: This is a contract-definition module. It contains ONLY type
 * definitions and no executable code. See architecture/FORBIDDEN_PATHS.md
 * for Integration Surface constraints.
 */

/**
 * ERP capability domains representing major ERP functional areas.
 * These domains are vendor-agnostic and represent abstract capabilities.
 */
export enum ERPDomain {
  /** Financial accounting and reporting */
  FINANCE = 'FINANCE',
  /** Human resources and workforce management */
  HUMAN_RESOURCES = 'HUMAN_RESOURCES',
  /** Supply chain and logistics */
  SUPPLY_CHAIN = 'SUPPLY_CHAIN',
  /** Customer relationship management */
  CUSTOMER_RELATIONS = 'CUSTOMER_RELATIONS',
  /** Manufacturing and production */
  MANUFACTURING = 'MANUFACTURING',
  /** Procurement and purchasing */
  PROCUREMENT = 'PROCUREMENT',
  /** Inventory and warehouse management */
  INVENTORY = 'INVENTORY',
  /** Project management */
  PROJECT_MANAGEMENT = 'PROJECT_MANAGEMENT',
  /** Sales and order management */
  SALES = 'SALES',
  /** Business intelligence and analytics */
  ANALYTICS = 'ANALYTICS',
}

/**
 * Subdomain definitions for more granular capability targeting.
 * Each subdomain belongs to a parent domain.
 */
export interface ERPSubdomain {
  /** Unique subdomain identifier */
  id: string;
  /** Parent domain */
  domain: ERPDomain;
  /** Human-readable name */
  name: string;
  /** Description of the subdomain's capabilities */
  description: string;
  /** Version of this subdomain definition */
  version: string;
}

/**
 * Capability declaration within a domain.
 * Represents a specific operation or function that can be simulated.
 */
export interface ERPCapability {
  /** Unique capability identifier */
  id: string;
  /** Domain this capability belongs to */
  domain: ERPDomain;
  /** Optional subdomain */
  subdomain?: string;
  /** Human-readable name */
  name: string;
  /** Detailed description */
  description: string;
  /** Version of this capability definition */
  version: string;
  /** Whether this capability is deprecated */
  deprecated?: boolean;
  /** Input schema reference (JSON Schema $id) */
  inputSchemaRef?: string;
  /** Output schema reference (JSON Schema $id) */
  outputSchemaRef?: string;
  /** Tags for categorization */
  tags?: string[];
}

/**
 * Domain manifest containing all capabilities for a domain.
 */
export interface ERPDomainManifest {
  /** Domain identifier */
  domain: ERPDomain;
  /** Manifest version */
  version: string;
  /** Last updated timestamp (ISO 8601) */
  lastUpdated: string;
  /** Subdomains within this domain */
  subdomains: ERPSubdomain[];
  /** Capabilities available in this domain */
  capabilities: ERPCapability[];
  /** Domain-level metadata */
  metadata?: {
    /** Maintainer information */
    maintainer?: string;
    /** Documentation URL */
    documentationUrl?: string;
    /** Stability status */
    stability?: 'experimental' | 'stable' | 'deprecated';
  };
}

/**
 * Complete ERP surface manifest containing all domains.
 */
export interface ERPSurfaceManifest {
  /** Manifest format version */
  formatVersion: '1.0';
  /** Manifest generation timestamp (ISO 8601) */
  generatedAt: string;
  /** All domain manifests */
  domains: ERPDomainManifest[];
  /** Surface-level metadata */
  metadata?: {
    /** Repository source */
    repository?: string;
    /** Build/commit reference */
    buildRef?: string;
  };
}
