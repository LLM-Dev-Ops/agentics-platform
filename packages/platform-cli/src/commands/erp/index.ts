/**
 * ERP Surface introspection commands
 *
 * ALL commands in this module are READ-ONLY operations.
 * They read from erp-surface schema manifests and never execute,
 * connect to, configure, or resolve ERP systems.
 *
 * Commands:
 * - domains: List available ERP capability domains
 * - events: List supported ERP events
 * - references: Show simulations and intents referencing ERP surfaces
 *
 * ARCHITECTURAL CONSTRAINTS:
 * - The CLI treats erp-surface as declarative metadata only
 * - Outputs are derived from schemas or manifests, not runtime calls
 * - No commands bypass simulation planning or deployment intent flows
 * - The platform CLI remains an orchestrator and explainer, never an executor
 */

export { erpDomains } from './domains.js';
export { erpEvents } from './events.js';
export { erpReferences, createEmptyReferenceIndex } from './references.js';
