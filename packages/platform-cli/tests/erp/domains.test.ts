/**
 * Tests for erp domains command
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ExecutionContext } from '../../src/types/context.js';

// Mock console.log to capture output
const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

describe('erp domains command', () => {
  const mockContext: ExecutionContext = {
    org: { orgId: 'test-org' },
    env: { envId: 'test-env', envType: 'development' },
    correlationId: 'test-correlation-id',
    timestamp: new Date().toISOString(),
    dryRun: false,
  };

  beforeEach(() => {
    consoleSpy.mockClear();
  });

  it('should list all ERP domains in table format by default', async () => {
    // Import dynamically to avoid module resolution issues in test
    const { erpDomains } = await import('../../src/commands/erp/domains.js');

    await erpDomains(mockContext, {});

    // Check that output was produced
    expect(consoleSpy).toHaveBeenCalled();

    // Check for expected domain names in output
    const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
    expect(output).toContain('FINANCE');
    expect(output).toContain('SUPPLY_CHAIN');
    expect(output).toContain('HUMAN_RESOURCES');
    expect(output).toContain('SALES');
    expect(output).toContain('INVENTORY');
  });

  it('should output JSON when format is json', async () => {
    const { erpDomains } = await import('../../src/commands/erp/domains.js');

    await erpDomains(mockContext, { format: 'json' });

    // Get the first call which should be the JSON output
    const jsonOutput = consoleSpy.mock.calls[0]?.[0];
    expect(jsonOutput).toBeDefined();

    // Parse and verify JSON structure
    const parsed = JSON.parse(jsonOutput as string);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeGreaterThan(0);

    // Check first domain structure
    const firstDomain = parsed[0];
    expect(firstDomain).toHaveProperty('domain');
    expect(firstDomain).toHaveProperty('version');
    expect(firstDomain).toHaveProperty('subdomains');
    expect(firstDomain).toHaveProperty('capabilities');
  });

  it('should filter by specific domain', async () => {
    const { erpDomains } = await import('../../src/commands/erp/domains.js');

    await erpDomains(mockContext, { format: 'json', domain: 'finance' });

    const jsonOutput = consoleSpy.mock.calls[0]?.[0];
    const parsed = JSON.parse(jsonOutput as string);

    expect(parsed.length).toBe(1);
    expect(parsed[0].domain).toBe('FINANCE');
  });

  it('should include capabilities in verbose mode', async () => {
    const { erpDomains } = await import('../../src/commands/erp/domains.js');

    await erpDomains(mockContext, { verbose: true });

    const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');

    // Verbose output should include capability details
    expect(output).toContain('Capabilities:');
    expect(output).toContain('finance.journal-entry.create');
  });
});

describe('ERP domain types', () => {
  it('should have correct domain enum values', async () => {
    const { ERPDomain } = await import('../../src/erp-surface-types.js');

    expect(ERPDomain.FINANCE).toBe('FINANCE');
    expect(ERPDomain.HUMAN_RESOURCES).toBe('HUMAN_RESOURCES');
    expect(ERPDomain.SUPPLY_CHAIN).toBe('SUPPLY_CHAIN');
    expect(ERPDomain.SALES).toBe('SALES');
    expect(ERPDomain.INVENTORY).toBe('INVENTORY');
  });
});
