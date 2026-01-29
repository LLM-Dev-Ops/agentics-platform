/**
 * Coherence Domain Services
 *
 * Implements ADR/DDD #005: System Coherence, Drift Detection, and Self-Governance
 *
 * This module provides the core services for:
 * - Drift Detection: Identifying divergence between expected and actual state
 * - Lineage Tracking: Maintaining artifact derivation history for temporal comparison
 * - Invariant Validation: Checking system-level invariants
 * - Human Oversight: Managing decisions requiring human authorization
 *
 * CRITICAL PRINCIPLES:
 * - Agentics does not self-correct decisions
 * - It preserves coherence so humans can govern change safely
 * - All findings are surfaced, never silently remediated
 */

// Drift Detection
export {
  DriftDetector,
  getDriftDetector,
  resetDriftDetector,
  type DriftDetectorConfig,
  type DriftDetectionContext,
} from './drift-detector.js';

// Lineage Tracking
export {
  LineageTracker,
  getLineageTracker,
  resetLineageTracker,
  type LineageTrackerConfig,
} from './lineage-tracker.js';

// Invariant Validation
export {
  InvariantValidator,
  getInvariantValidator,
  resetInvariantValidator,
  SYSTEM_INVARIANTS,
  type ValidationContext,
} from './invariant-validator.js';

// Human Oversight
export {
  HumanOversightService,
  getHumanOversightService,
  resetHumanOversightService,
  type HumanOversightConfig,
  type CreateDecisionRequest,
  type ResolveDecisionRequest,
} from './human-oversight.js';

// Coherence Assessor (combines all services)
export {
  CoherenceAssessor,
  getCoherenceAssessor,
  resetCoherenceAssessor,
  type CoherenceAssessorConfig,
} from './coherence-assessor.js';
