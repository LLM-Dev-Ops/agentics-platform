/**
 * erp domains command - list available ERP capability domains
 *
 * READ-ONLY: Reads from erp-surface schema manifests.
 * This command exposes ERP domains for introspection only.
 * It does NOT execute, connect to, configure, or resolve ERP systems.
 */

import chalk from 'chalk';
import type { ExecutionContext } from '../../types/context.js';
import {
  ERPDomain,
  type ERPDomainManifest,
} from '../../erp-surface-types.js';

export interface ErpDomainsOptions {
  format?: 'json' | 'table';
  domain?: string;
  verbose?: boolean;
}

/**
 * Static ERP domain data (loaded from erp-surface schemas)
 * In production, this would import from @agentics/erp-surface
 */
const ERP_DOMAINS: ERPDomainManifest[] = [
  {
    domain: ERPDomain.FINANCE,
    version: '1.0.0',
    lastUpdated: '2025-01-04T00:00:00Z',
    subdomains: [
      { id: 'finance.general-ledger', domain: ERPDomain.FINANCE, name: 'General Ledger', description: 'Core accounting and journal entry management', version: '1.0.0' },
      { id: 'finance.accounts-payable', domain: ERPDomain.FINANCE, name: 'Accounts Payable', description: 'Vendor invoice and payment processing', version: '1.0.0' },
      { id: 'finance.accounts-receivable', domain: ERPDomain.FINANCE, name: 'Accounts Receivable', description: 'Customer billing and collections', version: '1.0.0' },
      { id: 'finance.fixed-assets', domain: ERPDomain.FINANCE, name: 'Fixed Assets', description: 'Asset lifecycle and depreciation tracking', version: '1.0.0' },
    ],
    capabilities: [
      { id: 'finance.journal-entry.create', domain: ERPDomain.FINANCE, subdomain: 'finance.general-ledger', name: 'Create Journal Entry', description: 'Create a new journal entry with debits and credits', version: '1.0.0', tags: ['write', 'accounting'] },
      { id: 'finance.journal-entry.post', domain: ERPDomain.FINANCE, subdomain: 'finance.general-ledger', name: 'Post Journal Entry', description: 'Post a draft journal entry to the ledger', version: '1.0.0', tags: ['write', 'accounting', 'state-change'] },
      { id: 'finance.invoice.create', domain: ERPDomain.FINANCE, subdomain: 'finance.accounts-payable', name: 'Create Vendor Invoice', description: 'Record a vendor invoice for payment processing', version: '1.0.0', tags: ['write', 'payables'] },
      { id: 'finance.payment.process', domain: ERPDomain.FINANCE, subdomain: 'finance.accounts-payable', name: 'Process Payment', description: 'Execute payment to vendor', version: '1.0.0', tags: ['write', 'payables', 'financial-transaction'] },
    ],
    metadata: { maintainer: 'Platform Architecture Team', stability: 'stable' },
  },
  {
    domain: ERPDomain.SUPPLY_CHAIN,
    version: '1.0.0',
    lastUpdated: '2025-01-04T00:00:00Z',
    subdomains: [
      { id: 'supply-chain.purchasing', domain: ERPDomain.SUPPLY_CHAIN, name: 'Purchasing', description: 'Purchase order management and vendor relations', version: '1.0.0' },
      { id: 'supply-chain.logistics', domain: ERPDomain.SUPPLY_CHAIN, name: 'Logistics', description: 'Shipping, receiving, and transportation', version: '1.0.0' },
    ],
    capabilities: [
      { id: 'supply-chain.purchase-order.create', domain: ERPDomain.SUPPLY_CHAIN, subdomain: 'supply-chain.purchasing', name: 'Create Purchase Order', description: 'Create a new purchase order for goods or services', version: '1.0.0', tags: ['write', 'procurement'] },
      { id: 'supply-chain.shipment.receive', domain: ERPDomain.SUPPLY_CHAIN, subdomain: 'supply-chain.logistics', name: 'Receive Shipment', description: 'Record receipt of goods against a purchase order', version: '1.0.0', tags: ['write', 'logistics', 'inventory'] },
    ],
    metadata: { maintainer: 'Platform Architecture Team', stability: 'stable' },
  },
  {
    domain: ERPDomain.HUMAN_RESOURCES,
    version: '1.0.0',
    lastUpdated: '2025-01-04T00:00:00Z',
    subdomains: [
      { id: 'hr.employee-management', domain: ERPDomain.HUMAN_RESOURCES, name: 'Employee Management', description: 'Employee records and organizational data', version: '1.0.0' },
      { id: 'hr.payroll', domain: ERPDomain.HUMAN_RESOURCES, name: 'Payroll', description: 'Compensation and payroll processing', version: '1.0.0' },
      { id: 'hr.time-attendance', domain: ERPDomain.HUMAN_RESOURCES, name: 'Time & Attendance', description: 'Time tracking and absence management', version: '1.0.0' },
    ],
    capabilities: [
      { id: 'hr.employee.onboard', domain: ERPDomain.HUMAN_RESOURCES, subdomain: 'hr.employee-management', name: 'Onboard Employee', description: 'Create new employee record and initiate onboarding', version: '1.0.0', tags: ['write', 'employee-lifecycle'] },
      { id: 'hr.payroll.run', domain: ERPDomain.HUMAN_RESOURCES, subdomain: 'hr.payroll', name: 'Run Payroll', description: 'Execute payroll calculation and processing', version: '1.0.0', tags: ['write', 'financial-transaction', 'batch'] },
    ],
    metadata: { maintainer: 'Platform Architecture Team', stability: 'stable' },
  },
  {
    domain: ERPDomain.SALES,
    version: '1.0.0',
    lastUpdated: '2025-01-04T00:00:00Z',
    subdomains: [
      { id: 'sales.orders', domain: ERPDomain.SALES, name: 'Order Management', description: 'Sales order processing and fulfillment', version: '1.0.0' },
      { id: 'sales.pricing', domain: ERPDomain.SALES, name: 'Pricing', description: 'Product pricing and discount management', version: '1.0.0' },
    ],
    capabilities: [
      { id: 'sales.order.create', domain: ERPDomain.SALES, subdomain: 'sales.orders', name: 'Create Sales Order', description: 'Create a new customer sales order', version: '1.0.0', tags: ['write', 'order-management'] },
      { id: 'sales.order.fulfill', domain: ERPDomain.SALES, subdomain: 'sales.orders', name: 'Fulfill Order', description: 'Process order fulfillment and shipping', version: '1.0.0', tags: ['write', 'order-management', 'logistics'] },
    ],
    metadata: { maintainer: 'Platform Architecture Team', stability: 'stable' },
  },
  {
    domain: ERPDomain.INVENTORY,
    version: '1.0.0',
    lastUpdated: '2025-01-04T00:00:00Z',
    subdomains: [
      { id: 'inventory.warehouse', domain: ERPDomain.INVENTORY, name: 'Warehouse Management', description: 'Warehouse operations and storage', version: '1.0.0' },
      { id: 'inventory.stock', domain: ERPDomain.INVENTORY, name: 'Stock Control', description: 'Inventory levels and stock movements', version: '1.0.0' },
    ],
    capabilities: [
      { id: 'inventory.stock.adjust', domain: ERPDomain.INVENTORY, subdomain: 'inventory.stock', name: 'Adjust Stock', description: 'Record inventory adjustment (count, damage, etc.)', version: '1.0.0', tags: ['write', 'inventory'] },
      { id: 'inventory.transfer.create', domain: ERPDomain.INVENTORY, subdomain: 'inventory.warehouse', name: 'Create Transfer', description: 'Initiate inventory transfer between locations', version: '1.0.0', tags: ['write', 'inventory', 'logistics'] },
    ],
    metadata: { maintainer: 'Platform Architecture Team', stability: 'stable' },
  },
];

/**
 * Execute erp domains command
 */
export async function erpDomains(
  _context: ExecutionContext,
  options: ErpDomainsOptions = {}
): Promise<void> {
  let domains = ERP_DOMAINS;

  // Filter by specific domain if requested
  if (options.domain) {
    const domainKey = options.domain.toUpperCase().replace(/-/g, '_') as keyof typeof ERPDomain;
    const targetDomain = ERPDomain[domainKey];
    if (targetDomain) {
      domains = domains.filter(d => d.domain === targetDomain);
    } else {
      console.error(chalk.red(`Error: Unknown domain '${options.domain}'`));
      console.error(chalk.gray(`Available domains: ${Object.values(ERPDomain).join(', ')}`));
      process.exit(1);
    }
  }

  if (options.format === 'json') {
    console.log(JSON.stringify(domains, null, 2));
    return;
  }

  displayDomainsTable(domains, options.verbose ?? false);
}

/**
 * Display domains in table format
 */
function displayDomainsTable(domains: ERPDomainManifest[], verbose: boolean): void {
  console.log(chalk.bold('\nERP Capability Domains:\n'));
  console.log(chalk.gray('  Source: @agentics/erp-surface (declarative schema)\n'));

  for (const domain of domains) {
    const stabilityColor =
      domain.metadata?.stability === 'stable' ? chalk.green :
      domain.metadata?.stability === 'experimental' ? chalk.yellow :
      chalk.red;

    console.log(`  ${chalk.blue.bold(domain.domain)}`);
    console.log(`  ${chalk.gray('Version:')} ${domain.version}  ${chalk.gray('Status:')} ${stabilityColor(domain.metadata?.stability ?? 'unknown')}`);
    console.log(`  ${chalk.gray('Subdomains:')} ${domain.subdomains.length}  ${chalk.gray('Capabilities:')} ${domain.capabilities.length}`);

    if (verbose) {
      console.log();
      console.log(chalk.gray('  Subdomains:'));
      for (const sub of domain.subdomains) {
        console.log(`    ${chalk.cyan(sub.id)}`);
        console.log(`    ${chalk.gray(sub.description)}`);
      }
      console.log();
      console.log(chalk.gray('  Capabilities:'));
      for (const cap of domain.capabilities) {
        console.log(`    ${chalk.yellow(cap.id)}`);
        console.log(`    ${chalk.gray(cap.description)}`);
        if (cap.tags && cap.tags.length > 0) {
          console.log(`    ${chalk.gray('Tags:')} ${cap.tags.join(', ')}`);
        }
      }
    }

    console.log();
  }

  console.log(chalk.gray(`  Total: ${domains.length} domains, ${domains.reduce((sum, d) => sum + d.capabilities.length, 0)} capabilities`));
  console.log();
}
