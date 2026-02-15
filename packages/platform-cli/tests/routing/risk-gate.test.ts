/**
 * Tests for risk-gate enforcement layer
 */

import { describe, it, expect } from 'vitest';
import {
  enforceRiskGate,
  isGatedCommand,
  getRiskEntry,
  listGatedCommands,
} from '../../src/routing/risk-gate.js';
import { ConfirmationRequiredError } from '../../src/errors.js';
import type { ExecutionContext } from '../../src/types/context.js';

function makeContext(overrides: Partial<ExecutionContext> = {}): ExecutionContext {
  return {
    org: { orgId: 'test-org' },
    env: { envId: 'test-env', envType: 'development' },
    correlationId: 'test-correlation-id',
    timestamp: new Date().toISOString(),
    dryRun: false,
    confirmed: false,
    ...overrides,
  };
}

describe('risk-gate', () => {
  // ── Registry introspection ──────────────────────────────────────

  it('registers exactly the five gated commands', () => {
    const entries = listGatedCommands();
    const paths = entries.map((e) => e.commandPath);
    expect(paths).toEqual([
      'deploy run',
      'deploy rollback',
      'plan approve',
      'policy enable',
      'erp map',
    ]);
  });

  it('isGatedCommand returns true for all gated paths', () => {
    expect(isGatedCommand('deploy run')).toBe(true);
    expect(isGatedCommand('deploy rollback')).toBe(true);
    expect(isGatedCommand('plan approve')).toBe(true);
    expect(isGatedCommand('policy enable')).toBe(true);
    expect(isGatedCommand('erp map')).toBe(true);
  });

  it('isGatedCommand returns false for non-gated paths', () => {
    expect(isGatedCommand('org list')).toBe(false);
    expect(isGatedCommand('artifact inspect')).toBe(false);
    expect(isGatedCommand('intent submit')).toBe(false);
  });

  it('getRiskEntry returns correct metadata', () => {
    const entry = getRiskEntry('deploy run');
    expect(entry).toBeDefined();
    expect(entry!.riskLevel).toBe('critical');
    expect(entry!.reason).toContain('deployment');
  });

  it('getRiskEntry returns undefined for non-gated command', () => {
    expect(getRiskEntry('org list')).toBeUndefined();
  });

  // ── Enforcement: rejection without confirmation ─────────────────

  it('throws ConfirmationRequiredError for gated command without confirmed flag', () => {
    const ctx = makeContext({ confirmed: false });

    expect(() => enforceRiskGate('deploy run', ctx)).toThrow(ConfirmationRequiredError);
    expect(() => enforceRiskGate('deploy rollback', ctx)).toThrow(ConfirmationRequiredError);
    expect(() => enforceRiskGate('plan approve', ctx)).toThrow(ConfirmationRequiredError);
    expect(() => enforceRiskGate('policy enable', ctx)).toThrow(ConfirmationRequiredError);
    expect(() => enforceRiskGate('erp map', ctx)).toThrow(ConfirmationRequiredError);
  });

  it('thrown error carries correct command path and risk level', () => {
    const ctx = makeContext();

    try {
      enforceRiskGate('deploy run', ctx);
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ConfirmationRequiredError);
      const e = err as ConfirmationRequiredError;
      expect(e.commandPath).toBe('deploy run');
      expect(e.riskLevel).toBe('critical');
      expect(e.code).toBe('CONFIRMATION_REQUIRED');
      expect(e.exitCode).toBe(9);
    }
  });

  // ── Enforcement: pass-through with confirmation ─────────────────

  it('does not throw when confirmed is true', () => {
    const ctx = makeContext({ confirmed: true });

    expect(() => enforceRiskGate('deploy run', ctx)).not.toThrow();
    expect(() => enforceRiskGate('deploy rollback', ctx)).not.toThrow();
    expect(() => enforceRiskGate('plan approve', ctx)).not.toThrow();
    expect(() => enforceRiskGate('policy enable', ctx)).not.toThrow();
    expect(() => enforceRiskGate('erp map', ctx)).not.toThrow();
  });

  // ── Enforcement: dry-run bypass ─────────────────────────────────

  it('does not throw in dry-run mode even without confirmation', () => {
    const ctx = makeContext({ dryRun: true, confirmed: false });

    expect(() => enforceRiskGate('deploy run', ctx)).not.toThrow();
    expect(() => enforceRiskGate('deploy rollback', ctx)).not.toThrow();
  });

  // ── Non-gated commands pass through unconditionally ─────────────

  it('does not throw for non-gated commands regardless of confirmed flag', () => {
    const ctx = makeContext({ confirmed: false });

    expect(() => enforceRiskGate('org list', ctx)).not.toThrow();
    expect(() => enforceRiskGate('artifact inspect', ctx)).not.toThrow();
    expect(() => enforceRiskGate('intent submit', ctx)).not.toThrow();
    expect(() => enforceRiskGate('env switch', ctx)).not.toThrow();
  });
});
