/**
 * Tests for erp events command
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ExecutionContext } from '../../src/types/context.js';

// Mock console.log to capture output
const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

describe('erp events command', () => {
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

  it('should list all ERP events in table format by default', async () => {
    const { erpEvents } = await import('../../src/commands/erp/events.js');

    await erpEvents(mockContext, {});

    expect(consoleSpy).toHaveBeenCalled();

    const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
    expect(output).toContain('ERP Events');
    expect(output).toContain('finance.journal-entry.posted');
    expect(output).toContain('sales.order.created');
  });

  it('should output JSON when format is json', async () => {
    const { erpEvents } = await import('../../src/commands/erp/events.js');

    await erpEvents(mockContext, { format: 'json' });

    const jsonOutput = consoleSpy.mock.calls[0]?.[0];
    const parsed = JSON.parse(jsonOutput as string);

    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeGreaterThan(0);

    // Check event structure
    const firstEvent = parsed[0];
    expect(firstEvent).toHaveProperty('id');
    expect(firstEvent).toHaveProperty('name');
    expect(firstEvent).toHaveProperty('category');
    expect(firstEvent).toHaveProperty('domain');
    expect(firstEvent).toHaveProperty('direction');
  });

  it('should filter by domain', async () => {
    const { erpEvents } = await import('../../src/commands/erp/events.js');

    await erpEvents(mockContext, { format: 'json', domain: 'finance' });

    const jsonOutput = consoleSpy.mock.calls[0]?.[0];
    const parsed = JSON.parse(jsonOutput as string);

    // All events should be from FINANCE domain
    expect(parsed.every((e: any) => e.domain === 'FINANCE')).toBe(true);
  });

  it('should filter by direction', async () => {
    const { erpEvents } = await import('../../src/commands/erp/events.js');

    await erpEvents(mockContext, { format: 'json', direction: 'inbound' });

    const jsonOutput = consoleSpy.mock.calls[0]?.[0];
    const parsed = JSON.parse(jsonOutput as string);

    // All events should be inbound
    expect(parsed.every((e: any) => e.direction === 'inbound')).toBe(true);
  });

  it('should filter by category', async () => {
    const { erpEvents } = await import('../../src/commands/erp/events.js');

    await erpEvents(mockContext, { format: 'json', category: 'create' });

    const jsonOutput = consoleSpy.mock.calls[0]?.[0];
    const parsed = JSON.parse(jsonOutput as string);

    // All events should have CREATE category
    expect(parsed.every((e: any) => e.category === 'CREATE')).toBe(true);
  });
});

describe('ERP event types', () => {
  it('should have correct event category enum values', async () => {
    const { ERPEventCategory } = await import('../../src/erp-surface-types.js');

    expect(ERPEventCategory.CREATE).toBe('CREATE');
    expect(ERPEventCategory.UPDATE).toBe('UPDATE');
    expect(ERPEventCategory.DELETE).toBe('DELETE');
    expect(ERPEventCategory.STATE_CHANGE).toBe('STATE_CHANGE');
    expect(ERPEventCategory.PROCESS).toBe('PROCESS');
    expect(ERPEventCategory.NOTIFICATION).toBe('NOTIFICATION');
  });
});
