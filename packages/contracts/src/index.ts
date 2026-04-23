/**
 * @agentics/contracts
 *
 * Canonical schemas and contracts for all Agentics Platform agents and services.
 * This package defines the NON-NEGOTIABLE schemas that all agents MUST use.
 *
 * @packageDocumentation
 */

// Core decision schemas
export * from './decision/index.js';

// Agent contract definitions
export * from './agent/index.js';

// Telemetry and observability
export * from './telemetry/index.js';

// Validation utilities
export * from './validation.js';

// ADR-011 — simulation telemetry events
export * from './simulation-events.js';
