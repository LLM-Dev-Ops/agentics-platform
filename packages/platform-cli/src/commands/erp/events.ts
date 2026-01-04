/**
 * erp events command - list supported ERP events
 *
 * READ-ONLY: Reads from erp-surface schema manifests.
 * This command exposes ERP events for introspection only.
 * It does NOT execute, connect to, configure, or resolve ERP systems.
 */

import chalk from 'chalk';
import type { ExecutionContext } from '../../types/context.js';
import {
  ERPDomain,
  ERPEventCategory,
  type ERPEvent,
} from '../../erp-surface-types.js';

export interface ErpEventsOptions {
  format?: 'json' | 'table';
  domain?: string;
  category?: string;
  direction?: 'inbound' | 'outbound';
}

/**
 * Static ERP event data (loaded from erp-surface schemas)
 */
const ERP_EVENTS: ERPEvent[] = [
  // Finance events
  { id: 'finance.journal-entry.posted', name: 'Journal Entry Posted', category: ERPEventCategory.STATE_CHANGE, domain: ERPDomain.FINANCE, direction: 'outbound', description: 'Emitted when a journal entry is posted to the ledger', version: '1.0.0', delivery: 'at-least-once', priority: 'normal', tags: ['accounting', 'ledger'] },
  { id: 'finance.payment.completed', name: 'Payment Completed', category: ERPEventCategory.STATE_CHANGE, domain: ERPDomain.FINANCE, direction: 'outbound', description: 'Emitted when a payment is successfully processed', version: '1.0.0', delivery: 'at-least-once', priority: 'high', tags: ['payments', 'financial-transaction'] },
  { id: 'finance.invoice.received', name: 'Invoice Received', category: ERPEventCategory.CREATE, domain: ERPDomain.FINANCE, direction: 'inbound', description: 'Received when a new vendor invoice arrives', version: '1.0.0', delivery: 'at-least-once', priority: 'normal', tags: ['payables', 'invoice'] },
  // Supply Chain events
  { id: 'supply-chain.purchase-order.approved', name: 'Purchase Order Approved', category: ERPEventCategory.STATE_CHANGE, domain: ERPDomain.SUPPLY_CHAIN, direction: 'outbound', description: 'Emitted when a purchase order is approved', version: '1.0.0', delivery: 'at-least-once', priority: 'normal', tags: ['procurement', 'approval'] },
  { id: 'supply-chain.goods.received', name: 'Goods Received', category: ERPEventCategory.CREATE, domain: ERPDomain.SUPPLY_CHAIN, direction: 'outbound', description: 'Emitted when goods are received at a warehouse', version: '1.0.0', delivery: 'at-least-once', priority: 'normal', tags: ['logistics', 'receiving'] },
  // HR events
  { id: 'hr.employee.hired', name: 'Employee Hired', category: ERPEventCategory.CREATE, domain: ERPDomain.HUMAN_RESOURCES, direction: 'outbound', description: 'Emitted when a new employee is hired', version: '1.0.0', delivery: 'at-least-once', priority: 'normal', tags: ['employee-lifecycle', 'onboarding'] },
  { id: 'hr.payroll.processed', name: 'Payroll Processed', category: ERPEventCategory.PROCESS, domain: ERPDomain.HUMAN_RESOURCES, direction: 'outbound', description: 'Emitted when payroll processing completes', version: '1.0.0', delivery: 'at-least-once', priority: 'high', tags: ['payroll', 'financial-transaction'] },
  // Sales events
  { id: 'sales.order.created', name: 'Sales Order Created', category: ERPEventCategory.CREATE, domain: ERPDomain.SALES, direction: 'outbound', description: 'Emitted when a new sales order is created', version: '1.0.0', delivery: 'at-least-once', priority: 'normal', tags: ['order-management', 'sales'] },
  { id: 'sales.order.fulfilled', name: 'Sales Order Fulfilled', category: ERPEventCategory.STATE_CHANGE, domain: ERPDomain.SALES, direction: 'outbound', description: 'Emitted when a sales order is fulfilled', version: '1.0.0', delivery: 'at-least-once', priority: 'normal', tags: ['order-management', 'fulfillment'] },
  // Inventory events
  { id: 'inventory.stock.adjusted', name: 'Stock Adjusted', category: ERPEventCategory.UPDATE, domain: ERPDomain.INVENTORY, direction: 'outbound', description: 'Emitted when inventory levels are adjusted', version: '1.0.0', delivery: 'at-least-once', priority: 'normal', tags: ['inventory', 'stock'] },
  { id: 'inventory.low-stock.alert', name: 'Low Stock Alert', category: ERPEventCategory.NOTIFICATION, domain: ERPDomain.INVENTORY, direction: 'outbound', description: 'Emitted when inventory falls below threshold', version: '1.0.0', delivery: 'at-least-once', priority: 'high', tags: ['inventory', 'alert'] },
];

/**
 * Execute erp events command
 */
export async function erpEvents(
  _context: ExecutionContext,
  options: ErpEventsOptions = {}
): Promise<void> {
  let events = ERP_EVENTS;

  // Filter by domain
  if (options.domain) {
    const domainKey = options.domain.toUpperCase().replace(/-/g, '_') as keyof typeof ERPDomain;
    const targetDomain = ERPDomain[domainKey];
    if (targetDomain) {
      events = events.filter(e => e.domain === targetDomain);
    } else {
      console.error(chalk.red(`Error: Unknown domain '${options.domain}'`));
      console.error(chalk.gray(`Available domains: ${Object.values(ERPDomain).join(', ')}`));
      process.exit(1);
    }
  }

  // Filter by category
  if (options.category) {
    const categoryKey = options.category.toUpperCase() as keyof typeof ERPEventCategory;
    const targetCategory = ERPEventCategory[categoryKey];
    if (targetCategory) {
      events = events.filter(e => e.category === targetCategory);
    } else {
      console.error(chalk.red(`Error: Unknown category '${options.category}'`));
      console.error(chalk.gray(`Available categories: ${Object.values(ERPEventCategory).join(', ')}`));
      process.exit(1);
    }
  }

  // Filter by direction
  if (options.direction) {
    events = events.filter(e => e.direction === options.direction);
  }

  if (options.format === 'json') {
    console.log(JSON.stringify(events, null, 2));
    return;
  }

  displayEventsTable(events);
}

/**
 * Display events in table format
 */
function displayEventsTable(events: ERPEvent[]): void {
  console.log(chalk.bold('\nERP Events:\n'));
  console.log(chalk.gray('  Source: @agentics/erp-surface (declarative schema)\n'));

  // Group by domain
  const groupedByDomain = events.reduce<Record<string, ERPEvent[]>>((acc, event) => {
    if (!acc[event.domain]) {
      acc[event.domain] = [];
    }
    acc[event.domain]!.push(event);
    return acc;
  }, {});

  for (const [domain, domainEvents] of Object.entries(groupedByDomain)) {
    console.log(`  ${chalk.blue.bold(domain)}`);
    console.log();

    for (const event of domainEvents) {
      const directionColor = event.direction === 'inbound' ? chalk.cyan : chalk.green;
      const priorityColor =
        event.priority === 'critical' ? chalk.red :
        event.priority === 'high' ? chalk.yellow :
        chalk.gray;

      console.log(`    ${chalk.yellow(event.id)}`);
      console.log(`    ${chalk.white(event.name)}`);
      console.log(`    ${chalk.gray('Direction:')} ${directionColor(event.direction)}  ${chalk.gray('Category:')} ${event.category}`);
      console.log(`    ${chalk.gray('Priority:')} ${priorityColor(event.priority ?? 'normal')}  ${chalk.gray('Delivery:')} ${event.delivery ?? 'at-least-once'}`);
      console.log(`    ${chalk.gray(event.description)}`);
      if (event.tags && event.tags.length > 0) {
        console.log(`    ${chalk.gray('Tags:')} ${event.tags.join(', ')}`);
      }
      console.log();
    }
  }

  // Summary
  const inboundCount = events.filter(e => e.direction === 'inbound').length;
  const outboundCount = events.filter(e => e.direction === 'outbound').length;
  console.log(chalk.gray(`  Total: ${events.length} events (${inboundCount} inbound, ${outboundCount} outbound)`));
  console.log();
}
