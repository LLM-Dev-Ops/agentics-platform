/**
 * Tests for ERP Surface type definitions
 */

import { describe, it, expect } from 'vitest';
import {
  ERPDomain,
  ERPEventCategory,
  type ERPDomainManifest,
  type ERPEvent,
  type ERPCapability,
  type SimulationERPReference,
  type DeploymentIntentERPReference,
} from '../src/index.js';

describe('ERPDomain enum', () => {
  it('should have all expected domain values', () => {
    expect(ERPDomain.FINANCE).toBe('FINANCE');
    expect(ERPDomain.HUMAN_RESOURCES).toBe('HUMAN_RESOURCES');
    expect(ERPDomain.SUPPLY_CHAIN).toBe('SUPPLY_CHAIN');
    expect(ERPDomain.CUSTOMER_RELATIONS).toBe('CUSTOMER_RELATIONS');
    expect(ERPDomain.MANUFACTURING).toBe('MANUFACTURING');
    expect(ERPDomain.PROCUREMENT).toBe('PROCUREMENT');
    expect(ERPDomain.INVENTORY).toBe('INVENTORY');
    expect(ERPDomain.PROJECT_MANAGEMENT).toBe('PROJECT_MANAGEMENT');
    expect(ERPDomain.SALES).toBe('SALES');
    expect(ERPDomain.ANALYTICS).toBe('ANALYTICS');
  });

  it('should have exactly 10 domains', () => {
    expect(Object.keys(ERPDomain).length).toBe(10);
  });
});

describe('ERPEventCategory enum', () => {
  it('should have all expected category values', () => {
    expect(ERPEventCategory.CREATE).toBe('CREATE');
    expect(ERPEventCategory.UPDATE).toBe('UPDATE');
    expect(ERPEventCategory.DELETE).toBe('DELETE');
    expect(ERPEventCategory.STATE_CHANGE).toBe('STATE_CHANGE');
    expect(ERPEventCategory.PROCESS).toBe('PROCESS');
    expect(ERPEventCategory.SYNC).toBe('SYNC');
    expect(ERPEventCategory.NOTIFICATION).toBe('NOTIFICATION');
  });

  it('should have exactly 7 categories', () => {
    expect(Object.keys(ERPEventCategory).length).toBe(7);
  });
});

describe('ERPCapability type', () => {
  it('should allow creating valid capability objects', () => {
    const capability: ERPCapability = {
      id: 'finance.journal-entry.create',
      domain: ERPDomain.FINANCE,
      subdomain: 'finance.general-ledger',
      name: 'Create Journal Entry',
      description: 'Create a new journal entry with debits and credits',
      version: '1.0.0',
      tags: ['write', 'accounting'],
    };

    expect(capability.id).toBe('finance.journal-entry.create');
    expect(capability.domain).toBe(ERPDomain.FINANCE);
    expect(capability.subdomain).toBe('finance.general-ledger');
  });

  it('should allow optional fields to be undefined', () => {
    const minimalCapability: ERPCapability = {
      id: 'test.capability',
      domain: ERPDomain.SALES,
      name: 'Test Capability',
      description: 'A test capability',
      version: '1.0.0',
    };

    expect(minimalCapability.subdomain).toBeUndefined();
    expect(minimalCapability.tags).toBeUndefined();
    expect(minimalCapability.deprecated).toBeUndefined();
  });
});

describe('ERPEvent type', () => {
  it('should allow creating valid event objects', () => {
    const event: ERPEvent = {
      id: 'finance.journal-entry.posted',
      name: 'Journal Entry Posted',
      category: ERPEventCategory.STATE_CHANGE,
      domain: ERPDomain.FINANCE,
      direction: 'outbound',
      description: 'Emitted when a journal entry is posted to the ledger',
      version: '1.0.0',
      delivery: 'at-least-once',
      priority: 'normal',
      tags: ['accounting', 'ledger'],
    };

    expect(event.id).toBe('finance.journal-entry.posted');
    expect(event.category).toBe(ERPEventCategory.STATE_CHANGE);
    expect(event.direction).toBe('outbound');
    expect(event.delivery).toBe('at-least-once');
  });

  it('should support inbound direction', () => {
    const inboundEvent: ERPEvent = {
      id: 'finance.invoice.received',
      name: 'Invoice Received',
      category: ERPEventCategory.CREATE,
      domain: ERPDomain.FINANCE,
      direction: 'inbound',
      description: 'Received when a new vendor invoice arrives',
      version: '1.0.0',
    };

    expect(inboundEvent.direction).toBe('inbound');
  });
});

describe('ERPDomainManifest type', () => {
  it('should allow creating valid manifest objects', () => {
    const manifest: ERPDomainManifest = {
      domain: ERPDomain.FINANCE,
      version: '1.0.0',
      lastUpdated: '2025-01-04T00:00:00Z',
      subdomains: [
        {
          id: 'finance.general-ledger',
          domain: ERPDomain.FINANCE,
          name: 'General Ledger',
          description: 'Core accounting',
          version: '1.0.0',
        },
      ],
      capabilities: [
        {
          id: 'finance.journal-entry.create',
          domain: ERPDomain.FINANCE,
          name: 'Create Journal Entry',
          description: 'Create a journal entry',
          version: '1.0.0',
        },
      ],
      metadata: {
        maintainer: 'Test Team',
        stability: 'stable',
      },
    };

    expect(manifest.domain).toBe(ERPDomain.FINANCE);
    expect(manifest.subdomains.length).toBe(1);
    expect(manifest.capabilities.length).toBe(1);
    expect(manifest.metadata?.stability).toBe('stable');
  });
});

describe('Reference types', () => {
  it('should allow creating SimulationERPReference objects', () => {
    const simRef: SimulationERPReference = {
      id: 'sim-ref-001',
      simulationId: 'sim-finance-flow',
      simulationName: 'Finance Flow Simulation',
      capabilities: [
        {
          capabilityId: 'finance.journal-entry.create',
          domain: ERPDomain.FINANCE,
          required: true,
        },
      ],
      events: [
        {
          eventId: 'finance.journal-entry.posted',
          domain: ERPDomain.FINANCE,
          category: ERPEventCategory.STATE_CHANGE,
        },
      ],
      metadata: {
        createdAt: '2025-01-04T00:00:00Z',
        version: '1.0.0',
      },
    };

    expect(simRef.simulationId).toBe('sim-finance-flow');
    expect(simRef.capabilities.length).toBe(1);
    expect(simRef.events.length).toBe(1);
  });

  it('should allow creating DeploymentIntentERPReference objects', () => {
    const intentRef: DeploymentIntentERPReference = {
      id: 'intent-ref-001',
      intentId: 'intent-deploy-finance',
      intentType: 'deployment',
      targetEnvironment: 'staging',
      capabilities: [
        {
          capabilityId: 'finance.journal-entry.create',
          domain: ERPDomain.FINANCE,
          required: true,
        },
      ],
      validationStatus: 'valid',
    };

    expect(intentRef.intentType).toBe('deployment');
    expect(intentRef.validationStatus).toBe('valid');
  });
});
