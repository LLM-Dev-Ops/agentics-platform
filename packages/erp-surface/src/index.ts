/**
 * @agentics/erp-surface
 *
 * ERP Integration Surface - Canonical capability and event contract definitions
 *
 * This package defines the canonical ERP capability and event contracts for
 * simulation and deployment intent. It is strictly a contract-definition
 * repository containing only type definitions, event schemas, and capability
 * declarations.
 *
 * ARCHITECTURAL CONSTRAINTS (see architecture/FORBIDDEN_PATHS.md):
 * - Contains NO executable code
 * - Contains NO infrastructure configuration
 * - Contains NO adapter implementations
 * - May only depend on @agentics/shared (types only)
 *
 * CONSUMERS:
 * - Simulation repositories reference contracts for validation
 * - Deployment exporters reference contracts for intent declaration
 * - Platform CLI exposes contracts for introspection (read-only)
 *
 * @packageDocumentation
 */

// Re-export all types
export * from './types/index.js';

// Re-export schemas
export * from './schemas/index.js';
