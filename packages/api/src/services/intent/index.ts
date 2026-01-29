/**
 * Intent Domain Services
 *
 * Implements ADR/DDD #006: UI Control Surface Architecture
 *
 * This module provides the core service for managing user intents:
 * - Intent lifecycle: declare -> validate -> preview -> confirm -> execute
 * - Governance enforcement: same rules regardless of entry point (INV-U2)
 * - Audit completeness: full trail of all actions (INV-U6)
 *
 * The Intent Service integrates with:
 * - Human Oversight Service: for commitment decisions requiring approval
 * - Coherence Assessor: for drift-aware validation
 *
 * UI INVARIANTS ENFORCED:
 * - INV-U1: Entry Point Equivalence (UI = CLI semantics)
 * - INV-U2: Governance Uniformity (same validation regardless of entry point)
 * - INV-U3: Intent Explicitness (no inference from ambiguous input)
 * - INV-U4: Commitment Confirmation (explicit confirmation for state changes)
 * - INV-U5: Governance Visibility (surface constraints visibly)
 * - INV-U6: Audit Completeness (full audit trail for UI actions)
 */

export {
  IntentService,
  getIntentService,
  resetIntentService,
  type IntentServiceConfig,
  type IntentExecutor,
  type ExecutionContext,
} from './intent-service.js';
