/**
 * Risk gate - enforces explicit confirmation for high-risk commands
 *
 * State-changing operations that modify deployments, approve plans,
 * enable policies, or map ERP surfaces require the caller to pass
 * `confirmed: true` (CLI flag --confirmed). If the flag is absent
 * the gate rejects with a ConfirmationRequiredError (exit 9 / HTTP 409).
 *
 * The registry is a static, deterministic map — no runtime registration.
 */

import { ConfirmationRequiredError } from '../errors.js';
import type { ExecutionContext } from '../types/context.js';

/** Risk classification for a gated command */
export interface RiskEntry {
  /** Canonical command path used for matching (e.g. "deploy run") */
  commandPath: string;
  /** Why this command is gated */
  reason: string;
  /** Risk severity */
  riskLevel: 'high' | 'critical';
}

/**
 * Static registry of commands that require confirmation.
 * Add entries here — the gate reads this at call-time, so
 * the list is always deterministic and auditable.
 */
const GATED_COMMANDS: readonly RiskEntry[] = Object.freeze([
  {
    commandPath: 'deploy run',
    reason: 'Initiates a deployment to a target environment',
    riskLevel: 'critical',
  },
  {
    commandPath: 'deploy rollback',
    reason: 'Rolls back a deployment, potentially causing downtime',
    riskLevel: 'critical',
  },
  {
    commandPath: 'plan approve',
    reason: 'Approves an execution plan for downstream synthesis',
    riskLevel: 'high',
  },
  {
    commandPath: 'policy enable',
    reason: 'Activates a governance policy affecting all operations',
    riskLevel: 'high',
  },
  {
    commandPath: 'erp map',
    reason: 'Maps ERP surface capabilities to live integrations',
    riskLevel: 'high',
  },
]);

/**
 * Lookup table keyed by commandPath for O(1) matching.
 */
const gateIndex: ReadonlyMap<string, RiskEntry> = new Map(
  GATED_COMMANDS.map((entry) => [entry.commandPath, entry]),
);

/**
 * Check whether a command path is gated.
 */
export function isGatedCommand(commandPath: string): boolean {
  return gateIndex.has(commandPath);
}

/**
 * Return the risk entry for a command, or undefined if not gated.
 */
export function getRiskEntry(commandPath: string): RiskEntry | undefined {
  return gateIndex.get(commandPath);
}

/**
 * Return the full list of gated commands (for introspection / help text).
 */
export function listGatedCommands(): readonly RiskEntry[] {
  return GATED_COMMANDS;
}

/**
 * Enforce the confirmation gate.
 *
 * Call this early in the dispatch pipeline — before any side-effects.
 *
 * @param commandPath - Canonical command path ("deploy run", etc.)
 * @param context     - Current execution context (carries `confirmed`)
 * @throws ConfirmationRequiredError when gated and not confirmed
 */
export function enforceRiskGate(
  commandPath: string,
  context: ExecutionContext,
): void {
  const entry = gateIndex.get(commandPath);

  if (!entry) {
    return; // not gated — proceed
  }

  // Dry-run mode bypasses the gate (no side-effects to protect against)
  if (context.dryRun) {
    return;
  }

  if (!context.confirmed) {
    throw new ConfirmationRequiredError(entry.commandPath, entry.riskLevel);
  }
}
