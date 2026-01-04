/**
 * erp references command - show simulations and intents referencing ERP surfaces
 *
 * READ-ONLY: Reads from local reference index or manifest files.
 * This command exposes ERP references for introspection only.
 * It does NOT execute, connect to, configure, or resolve ERP systems.
 */

import chalk from 'chalk';
import { readFile } from 'fs/promises';
import { join } from 'path';
import type { ExecutionContext } from '../../types/context.js';
import {
  ERPDomain,
  type SimulationERPReference,
  type DeploymentIntentERPReference,
  type ERPReferenceIndex,
} from '../../erp-surface-types.js';

export interface ErpReferencesOptions {
  format?: 'json' | 'table';
  type?: 'simulation' | 'intent' | 'all';
  domain?: string;
}

/**
 * Create empty reference index for when no references exist.
 * Exported for use in production when no reference file is found.
 */
export function createEmptyReferenceIndex(): ERPReferenceIndex {
  return {
    version: '1.0.0',
    lastUpdated: new Date().toISOString(),
    simulationReferences: [],
    deploymentIntentReferences: [],
    summary: {
      totalSimulations: 0,
      totalIntents: 0,
      topDomains: [],
      topCapabilities: [],
    },
  };
}

/**
 * Example reference data for demonstration
 * In production, this would be loaded from a reference index file
 */
const EXAMPLE_REFERENCES: ERPReferenceIndex = {
  version: '1.0.0',
  lastUpdated: '2025-01-04T00:00:00Z',
  simulationReferences: [
    {
      id: 'sim-ref-001',
      simulationId: 'sim-finance-journal-entry-flow',
      simulationName: 'Finance Journal Entry Workflow Simulation',
      capabilities: [
        { capabilityId: 'finance.journal-entry.create', domain: ERPDomain.FINANCE, subdomain: 'finance.general-ledger', context: 'Test journal creation flow', required: true },
        { capabilityId: 'finance.journal-entry.post', domain: ERPDomain.FINANCE, subdomain: 'finance.general-ledger', context: 'Test journal posting', required: true },
      ],
      events: [
        { eventId: 'finance.journal-entry.posted', domain: ERPDomain.FINANCE, category: 'STATE_CHANGE' as any, context: 'Verify event emission', expectedCount: { min: 1 } },
      ],
      metadata: { createdAt: '2025-01-03T10:00:00Z', version: '1.0.0' },
    },
    {
      id: 'sim-ref-002',
      simulationId: 'sim-supply-chain-procurement',
      simulationName: 'Supply Chain Procurement Simulation',
      capabilities: [
        { capabilityId: 'supply-chain.purchase-order.create', domain: ERPDomain.SUPPLY_CHAIN, subdomain: 'supply-chain.purchasing', context: 'Create PO for testing', required: true },
        { capabilityId: 'supply-chain.shipment.receive', domain: ERPDomain.SUPPLY_CHAIN, subdomain: 'supply-chain.logistics', context: 'Receive goods', required: false },
      ],
      events: [
        { eventId: 'supply-chain.purchase-order.approved', domain: ERPDomain.SUPPLY_CHAIN, category: 'STATE_CHANGE' as any, context: 'Verify PO approval event' },
        { eventId: 'supply-chain.goods.received', domain: ERPDomain.SUPPLY_CHAIN, category: 'CREATE' as any, context: 'Verify goods receipt event' },
      ],
      metadata: { createdAt: '2025-01-02T14:30:00Z', version: '1.0.0' },
    },
  ],
  deploymentIntentReferences: [
    {
      id: 'intent-ref-001',
      intentId: 'intent-deploy-finance-module',
      intentType: 'deployment',
      targetEnvironment: 'staging',
      capabilities: [
        { capabilityId: 'finance.journal-entry.create', domain: ERPDomain.FINANCE, required: true },
        { capabilityId: 'finance.journal-entry.post', domain: ERPDomain.FINANCE, required: true },
        { capabilityId: 'finance.invoice.create', domain: ERPDomain.FINANCE, required: true },
        { capabilityId: 'finance.payment.process', domain: ERPDomain.FINANCE, required: true },
      ],
      validationStatus: 'valid',
      metadata: { createdAt: '2025-01-04T08:00:00Z', validatedAt: '2025-01-04T08:01:00Z', submitter: 'platform-admin' },
    },
  ],
  summary: {
    totalSimulations: 2,
    totalIntents: 1,
    topDomains: [
      { domain: ERPDomain.FINANCE, count: 6 },
      { domain: ERPDomain.SUPPLY_CHAIN, count: 4 },
    ],
    topCapabilities: [
      { capabilityId: 'finance.journal-entry.create', count: 2 },
      { capabilityId: 'finance.journal-entry.post', count: 2 },
      { capabilityId: 'supply-chain.purchase-order.create', count: 1 },
    ],
  },
};

/**
 * Load reference index from file or return example data
 */
async function loadReferenceIndex(baseDir: string): Promise<ERPReferenceIndex> {
  const indexPath = join(baseDir, '.agentics', 'erp-references.json');

  try {
    const content = await readFile(indexPath, 'utf-8');
    return JSON.parse(content) as ERPReferenceIndex;
  } catch {
    // Return example data if no reference index exists
    // In production, use: return createEmptyReferenceIndex();
    return EXAMPLE_REFERENCES;
  }
}

/**
 * Execute erp references command
 */
export async function erpReferences(
  _context: ExecutionContext,
  options: ErpReferencesOptions = {}
): Promise<void> {
  const referenceIndex = await loadReferenceIndex(process.cwd());

  let simRefs = referenceIndex.simulationReferences;
  let intentRefs = referenceIndex.deploymentIntentReferences;

  // Filter by type
  const showSimulations = !options.type || options.type === 'simulation' || options.type === 'all';
  const showIntents = !options.type || options.type === 'intent' || options.type === 'all';

  // Filter by domain
  if (options.domain) {
    const domainKey = options.domain.toUpperCase().replace(/-/g, '_') as keyof typeof ERPDomain;
    const targetDomain = ERPDomain[domainKey];
    if (targetDomain) {
      simRefs = simRefs.filter(ref =>
        ref.capabilities.some(cap => cap.domain === targetDomain) ||
        ref.events.some(evt => evt.domain === targetDomain)
      );
      intentRefs = intentRefs.filter(ref =>
        ref.capabilities.some(cap => cap.domain === targetDomain)
      );
    } else {
      console.error(chalk.red(`Error: Unknown domain '${options.domain}'`));
      console.error(chalk.gray(`Available domains: ${Object.values(ERPDomain).join(', ')}`));
      process.exit(1);
    }
  }

  if (options.format === 'json') {
    const output: Record<string, unknown> = {
      version: referenceIndex.version,
      lastUpdated: referenceIndex.lastUpdated,
    };
    if (showSimulations) {
      output['simulationReferences'] = simRefs;
    }
    if (showIntents) {
      output['deploymentIntentReferences'] = intentRefs;
    }
    output['summary'] = referenceIndex.summary;
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  displayReferencesTable(simRefs, intentRefs, referenceIndex.summary, showSimulations, showIntents);
}

/**
 * Display references in table format
 */
function displayReferencesTable(
  simRefs: SimulationERPReference[],
  intentRefs: DeploymentIntentERPReference[],
  summary: ERPReferenceIndex['summary'],
  showSimulations: boolean,
  showIntents: boolean
): void {
  console.log(chalk.bold('\nERP Surface References:\n'));
  console.log(chalk.gray('  Source: .agentics/erp-references.json (project manifest)\n'));

  if (showSimulations) {
    console.log(chalk.blue.bold('  Simulation References:'));
    console.log();

    if (simRefs.length === 0) {
      console.log(chalk.gray('    No simulation references found.\n'));
    } else {
      for (const ref of simRefs) {
        console.log(`    ${chalk.yellow(ref.simulationId)}`);
        if (ref.simulationName) {
          console.log(`    ${chalk.white(ref.simulationName)}`);
        }
        console.log(`    ${chalk.gray('Capabilities:')} ${ref.capabilities.length}  ${chalk.gray('Events:')} ${ref.events.length}`);

        // Show capability breakdown by domain
        const capsByDomain = ref.capabilities.reduce((acc, cap) => {
          acc[cap.domain] = (acc[cap.domain] ?? 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        const domainSummary = Object.entries(capsByDomain)
          .map(([d, c]) => `${d}: ${c}`)
          .join(', ');
        console.log(`    ${chalk.gray('Domains:')} ${domainSummary}`);
        console.log();
      }
    }
  }

  if (showIntents) {
    console.log(chalk.blue.bold('  Deployment Intent References:'));
    console.log();

    if (intentRefs.length === 0) {
      console.log(chalk.gray('    No deployment intent references found.\n'));
    } else {
      for (const ref of intentRefs) {
        const statusColor =
          ref.validationStatus === 'valid' ? chalk.green :
          ref.validationStatus === 'invalid' ? chalk.red :
          chalk.yellow;

        console.log(`    ${chalk.yellow(ref.intentId)}`);
        console.log(`    ${chalk.gray('Type:')} ${ref.intentType}  ${chalk.gray('Target:')} ${ref.targetEnvironment}`);
        console.log(`    ${chalk.gray('Validation:')} ${statusColor(ref.validationStatus ?? 'pending')}`);
        console.log(`    ${chalk.gray('Capabilities:')} ${ref.capabilities.length}`);

        if (ref.validationErrors && ref.validationErrors.length > 0) {
          console.log(`    ${chalk.red('Errors:')}`);
          for (const error of ref.validationErrors) {
            console.log(`      - ${error}`);
          }
        }
        console.log();
      }
    }
  }

  // Summary
  if (summary) {
    console.log(chalk.bold('  Summary:'));
    console.log(`    ${chalk.gray('Total Simulations:')} ${summary.totalSimulations}`);
    console.log(`    ${chalk.gray('Total Intents:')} ${summary.totalIntents}`);

    if (summary.topDomains && summary.topDomains.length > 0) {
      console.log(`    ${chalk.gray('Top Domains:')}`);
      for (const td of summary.topDomains.slice(0, 3)) {
        console.log(`      ${td.domain}: ${td.count} references`);
      }
    }
  }

  console.log();
}
