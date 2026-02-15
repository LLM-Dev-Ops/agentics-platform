/**
 * Tests for erp references command
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ExecutionContext } from '../../src/types/context.js';

// Mock console.log to capture output
const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

describe('erp references command', () => {
  const mockContext: ExecutionContext = {
    org: { orgId: 'test-org' },
    env: { envId: 'test-env', envType: 'development' },
    correlationId: 'test-correlation-id',
    timestamp: new Date().toISOString(),
    dryRun: false,
    confirmed: false,
  };

  beforeEach(() => {
    consoleSpy.mockClear();
  });

  it('should list all ERP references in table format by default', async () => {
    const { erpReferences } = await import('../../src/commands/erp/references.js');

    await erpReferences(mockContext, {});

    expect(consoleSpy).toHaveBeenCalled();

    const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
    expect(output).toContain('ERP Surface References');
    expect(output).toContain('Simulation References');
    expect(output).toContain('Deployment Intent References');
  });

  it('should output JSON when format is json', async () => {
    const { erpReferences } = await import('../../src/commands/erp/references.js');

    await erpReferences(mockContext, { format: 'json' });

    const jsonOutput = consoleSpy.mock.calls[0]?.[0];
    const parsed = JSON.parse(jsonOutput as string);

    expect(parsed).toHaveProperty('version');
    expect(parsed).toHaveProperty('lastUpdated');
    expect(parsed).toHaveProperty('simulationReferences');
    expect(parsed).toHaveProperty('deploymentIntentReferences');
    expect(parsed).toHaveProperty('summary');
  });

  it('should filter by simulation type', async () => {
    const { erpReferences } = await import('../../src/commands/erp/references.js');

    await erpReferences(mockContext, { format: 'json', type: 'simulation' });

    const jsonOutput = consoleSpy.mock.calls[0]?.[0];
    const parsed = JSON.parse(jsonOutput as string);

    expect(parsed).toHaveProperty('simulationReferences');
    expect(parsed).not.toHaveProperty('deploymentIntentReferences');
  });

  it('should filter by intent type', async () => {
    const { erpReferences } = await import('../../src/commands/erp/references.js');

    await erpReferences(mockContext, { format: 'json', type: 'intent' });

    const jsonOutput = consoleSpy.mock.calls[0]?.[0];
    const parsed = JSON.parse(jsonOutput as string);

    expect(parsed).not.toHaveProperty('simulationReferences');
    expect(parsed).toHaveProperty('deploymentIntentReferences');
  });

  it('should filter by domain', async () => {
    const { erpReferences } = await import('../../src/commands/erp/references.js');

    await erpReferences(mockContext, { format: 'json', domain: 'finance' });

    const jsonOutput = consoleSpy.mock.calls[0]?.[0];
    const parsed = JSON.parse(jsonOutput as string);

    // References should only include those with FINANCE domain capabilities
    if (parsed.simulationReferences) {
      for (const ref of parsed.simulationReferences) {
        const hasFinance = ref.capabilities.some((c: any) => c.domain === 'FINANCE') ||
                          ref.events.some((e: any) => e.domain === 'FINANCE');
        expect(hasFinance).toBe(true);
      }
    }
  });
});

describe('ERP reference types', () => {
  it('should have correct reference type structure', async () => {
    const types = await import('../../src/erp-surface-types.js');

    // Test that we can create valid reference objects
    const simRef: types.SimulationERPReference = {
      id: 'test-sim-ref',
      simulationId: 'test-sim',
      capabilities: [
        { capabilityId: 'test.cap', domain: types.ERPDomain.FINANCE }
      ],
      events: [],
    };

    expect(simRef.id).toBe('test-sim-ref');
    expect(simRef.capabilities[0]?.domain).toBe(types.ERPDomain.FINANCE);
  });
});
