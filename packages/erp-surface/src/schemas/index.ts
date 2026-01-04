/**
 * ERP Surface Schema Definitions
 *
 * This module provides static schema data for ERP domains, events, and references.
 * These schemas are used by the platform CLI for introspection and by simulation
 * repositories for validation.
 *
 * IMPORTANT: This module contains ONLY static data declarations.
 * No runtime logic, no I/O operations, no network calls.
 */

import {
  ERPDomain,
  ERPEventCategory,
  type ERPDomainManifest,
  type ERPEventManifest,
} from '../types/index.js';

/**
 * Static domain manifest for Finance domain
 */
export const FINANCE_DOMAIN: ERPDomainManifest = {
  domain: ERPDomain.FINANCE,
  version: '1.0.0',
  lastUpdated: '2025-01-04T00:00:00Z',
  subdomains: [
    {
      id: 'finance.general-ledger',
      domain: ERPDomain.FINANCE,
      name: 'General Ledger',
      description: 'Core accounting and journal entry management',
      version: '1.0.0',
    },
    {
      id: 'finance.accounts-payable',
      domain: ERPDomain.FINANCE,
      name: 'Accounts Payable',
      description: 'Vendor invoice and payment processing',
      version: '1.0.0',
    },
    {
      id: 'finance.accounts-receivable',
      domain: ERPDomain.FINANCE,
      name: 'Accounts Receivable',
      description: 'Customer billing and collections',
      version: '1.0.0',
    },
    {
      id: 'finance.fixed-assets',
      domain: ERPDomain.FINANCE,
      name: 'Fixed Assets',
      description: 'Asset lifecycle and depreciation tracking',
      version: '1.0.0',
    },
  ],
  capabilities: [
    {
      id: 'finance.journal-entry.create',
      domain: ERPDomain.FINANCE,
      subdomain: 'finance.general-ledger',
      name: 'Create Journal Entry',
      description: 'Create a new journal entry with debits and credits',
      version: '1.0.0',
      tags: ['write', 'accounting'],
    },
    {
      id: 'finance.journal-entry.post',
      domain: ERPDomain.FINANCE,
      subdomain: 'finance.general-ledger',
      name: 'Post Journal Entry',
      description: 'Post a draft journal entry to the ledger',
      version: '1.0.0',
      tags: ['write', 'accounting', 'state-change'],
    },
    {
      id: 'finance.invoice.create',
      domain: ERPDomain.FINANCE,
      subdomain: 'finance.accounts-payable',
      name: 'Create Vendor Invoice',
      description: 'Record a vendor invoice for payment processing',
      version: '1.0.0',
      tags: ['write', 'payables'],
    },
    {
      id: 'finance.payment.process',
      domain: ERPDomain.FINANCE,
      subdomain: 'finance.accounts-payable',
      name: 'Process Payment',
      description: 'Execute payment to vendor',
      version: '1.0.0',
      tags: ['write', 'payables', 'financial-transaction'],
    },
  ],
  metadata: {
    maintainer: 'Platform Architecture Team',
    stability: 'stable',
  },
};

/**
 * Static domain manifest for Supply Chain domain
 */
export const SUPPLY_CHAIN_DOMAIN: ERPDomainManifest = {
  domain: ERPDomain.SUPPLY_CHAIN,
  version: '1.0.0',
  lastUpdated: '2025-01-04T00:00:00Z',
  subdomains: [
    {
      id: 'supply-chain.purchasing',
      domain: ERPDomain.SUPPLY_CHAIN,
      name: 'Purchasing',
      description: 'Purchase order management and vendor relations',
      version: '1.0.0',
    },
    {
      id: 'supply-chain.logistics',
      domain: ERPDomain.SUPPLY_CHAIN,
      name: 'Logistics',
      description: 'Shipping, receiving, and transportation',
      version: '1.0.0',
    },
  ],
  capabilities: [
    {
      id: 'supply-chain.purchase-order.create',
      domain: ERPDomain.SUPPLY_CHAIN,
      subdomain: 'supply-chain.purchasing',
      name: 'Create Purchase Order',
      description: 'Create a new purchase order for goods or services',
      version: '1.0.0',
      tags: ['write', 'procurement'],
    },
    {
      id: 'supply-chain.shipment.receive',
      domain: ERPDomain.SUPPLY_CHAIN,
      subdomain: 'supply-chain.logistics',
      name: 'Receive Shipment',
      description: 'Record receipt of goods against a purchase order',
      version: '1.0.0',
      tags: ['write', 'logistics', 'inventory'],
    },
  ],
  metadata: {
    maintainer: 'Platform Architecture Team',
    stability: 'stable',
  },
};

/**
 * Static domain manifest for Human Resources domain
 */
export const HUMAN_RESOURCES_DOMAIN: ERPDomainManifest = {
  domain: ERPDomain.HUMAN_RESOURCES,
  version: '1.0.0',
  lastUpdated: '2025-01-04T00:00:00Z',
  subdomains: [
    {
      id: 'hr.employee-management',
      domain: ERPDomain.HUMAN_RESOURCES,
      name: 'Employee Management',
      description: 'Employee records and organizational data',
      version: '1.0.0',
    },
    {
      id: 'hr.payroll',
      domain: ERPDomain.HUMAN_RESOURCES,
      name: 'Payroll',
      description: 'Compensation and payroll processing',
      version: '1.0.0',
    },
    {
      id: 'hr.time-attendance',
      domain: ERPDomain.HUMAN_RESOURCES,
      name: 'Time & Attendance',
      description: 'Time tracking and absence management',
      version: '1.0.0',
    },
  ],
  capabilities: [
    {
      id: 'hr.employee.onboard',
      domain: ERPDomain.HUMAN_RESOURCES,
      subdomain: 'hr.employee-management',
      name: 'Onboard Employee',
      description: 'Create new employee record and initiate onboarding',
      version: '1.0.0',
      tags: ['write', 'employee-lifecycle'],
    },
    {
      id: 'hr.payroll.run',
      domain: ERPDomain.HUMAN_RESOURCES,
      subdomain: 'hr.payroll',
      name: 'Run Payroll',
      description: 'Execute payroll calculation and processing',
      version: '1.0.0',
      tags: ['write', 'financial-transaction', 'batch'],
    },
  ],
  metadata: {
    maintainer: 'Platform Architecture Team',
    stability: 'stable',
  },
};

/**
 * Static domain manifest for Sales domain
 */
export const SALES_DOMAIN: ERPDomainManifest = {
  domain: ERPDomain.SALES,
  version: '1.0.0',
  lastUpdated: '2025-01-04T00:00:00Z',
  subdomains: [
    {
      id: 'sales.orders',
      domain: ERPDomain.SALES,
      name: 'Order Management',
      description: 'Sales order processing and fulfillment',
      version: '1.0.0',
    },
    {
      id: 'sales.pricing',
      domain: ERPDomain.SALES,
      name: 'Pricing',
      description: 'Product pricing and discount management',
      version: '1.0.0',
    },
  ],
  capabilities: [
    {
      id: 'sales.order.create',
      domain: ERPDomain.SALES,
      subdomain: 'sales.orders',
      name: 'Create Sales Order',
      description: 'Create a new customer sales order',
      version: '1.0.0',
      tags: ['write', 'order-management'],
    },
    {
      id: 'sales.order.fulfill',
      domain: ERPDomain.SALES,
      subdomain: 'sales.orders',
      name: 'Fulfill Order',
      description: 'Process order fulfillment and shipping',
      version: '1.0.0',
      tags: ['write', 'order-management', 'logistics'],
    },
  ],
  metadata: {
    maintainer: 'Platform Architecture Team',
    stability: 'stable',
  },
};

/**
 * Static domain manifest for Inventory domain
 */
export const INVENTORY_DOMAIN: ERPDomainManifest = {
  domain: ERPDomain.INVENTORY,
  version: '1.0.0',
  lastUpdated: '2025-01-04T00:00:00Z',
  subdomains: [
    {
      id: 'inventory.warehouse',
      domain: ERPDomain.INVENTORY,
      name: 'Warehouse Management',
      description: 'Warehouse operations and storage',
      version: '1.0.0',
    },
    {
      id: 'inventory.stock',
      domain: ERPDomain.INVENTORY,
      name: 'Stock Control',
      description: 'Inventory levels and stock movements',
      version: '1.0.0',
    },
  ],
  capabilities: [
    {
      id: 'inventory.stock.adjust',
      domain: ERPDomain.INVENTORY,
      subdomain: 'inventory.stock',
      name: 'Adjust Stock',
      description: 'Record inventory adjustment (count, damage, etc.)',
      version: '1.0.0',
      tags: ['write', 'inventory'],
    },
    {
      id: 'inventory.transfer.create',
      domain: ERPDomain.INVENTORY,
      subdomain: 'inventory.warehouse',
      name: 'Create Transfer',
      description: 'Initiate inventory transfer between locations',
      version: '1.0.0',
      tags: ['write', 'inventory', 'logistics'],
    },
  ],
  metadata: {
    maintainer: 'Platform Architecture Team',
    stability: 'stable',
  },
};

/**
 * All domain manifests
 */
export const ERP_DOMAIN_MANIFESTS: ERPDomainManifest[] = [
  FINANCE_DOMAIN,
  SUPPLY_CHAIN_DOMAIN,
  HUMAN_RESOURCES_DOMAIN,
  SALES_DOMAIN,
  INVENTORY_DOMAIN,
];

/**
 * Static event manifest
 */
export const ERP_EVENT_MANIFEST: ERPEventManifest = {
  version: '1.0.0',
  lastUpdated: '2025-01-04T00:00:00Z',
  events: [
    // Finance events
    {
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
    },
    {
      id: 'finance.payment.completed',
      name: 'Payment Completed',
      category: ERPEventCategory.STATE_CHANGE,
      domain: ERPDomain.FINANCE,
      direction: 'outbound',
      description: 'Emitted when a payment is successfully processed',
      version: '1.0.0',
      delivery: 'at-least-once',
      priority: 'high',
      tags: ['payments', 'financial-transaction'],
    },
    {
      id: 'finance.invoice.received',
      name: 'Invoice Received',
      category: ERPEventCategory.CREATE,
      domain: ERPDomain.FINANCE,
      direction: 'inbound',
      description: 'Received when a new vendor invoice arrives',
      version: '1.0.0',
      delivery: 'at-least-once',
      priority: 'normal',
      tags: ['payables', 'invoice'],
    },
    // Supply Chain events
    {
      id: 'supply-chain.purchase-order.approved',
      name: 'Purchase Order Approved',
      category: ERPEventCategory.STATE_CHANGE,
      domain: ERPDomain.SUPPLY_CHAIN,
      direction: 'outbound',
      description: 'Emitted when a purchase order is approved',
      version: '1.0.0',
      delivery: 'at-least-once',
      priority: 'normal',
      tags: ['procurement', 'approval'],
    },
    {
      id: 'supply-chain.goods.received',
      name: 'Goods Received',
      category: ERPEventCategory.CREATE,
      domain: ERPDomain.SUPPLY_CHAIN,
      direction: 'outbound',
      description: 'Emitted when goods are received at a warehouse',
      version: '1.0.0',
      delivery: 'at-least-once',
      priority: 'normal',
      tags: ['logistics', 'receiving'],
    },
    // HR events
    {
      id: 'hr.employee.hired',
      name: 'Employee Hired',
      category: ERPEventCategory.CREATE,
      domain: ERPDomain.HUMAN_RESOURCES,
      direction: 'outbound',
      description: 'Emitted when a new employee is hired',
      version: '1.0.0',
      delivery: 'at-least-once',
      priority: 'normal',
      tags: ['employee-lifecycle', 'onboarding'],
    },
    {
      id: 'hr.payroll.processed',
      name: 'Payroll Processed',
      category: ERPEventCategory.PROCESS,
      domain: ERPDomain.HUMAN_RESOURCES,
      direction: 'outbound',
      description: 'Emitted when payroll processing completes',
      version: '1.0.0',
      delivery: 'at-least-once',
      priority: 'high',
      tags: ['payroll', 'financial-transaction'],
    },
    // Sales events
    {
      id: 'sales.order.created',
      name: 'Sales Order Created',
      category: ERPEventCategory.CREATE,
      domain: ERPDomain.SALES,
      direction: 'outbound',
      description: 'Emitted when a new sales order is created',
      version: '1.0.0',
      delivery: 'at-least-once',
      priority: 'normal',
      tags: ['order-management', 'sales'],
    },
    {
      id: 'sales.order.fulfilled',
      name: 'Sales Order Fulfilled',
      category: ERPEventCategory.STATE_CHANGE,
      domain: ERPDomain.SALES,
      direction: 'outbound',
      description: 'Emitted when a sales order is fulfilled',
      version: '1.0.0',
      delivery: 'at-least-once',
      priority: 'normal',
      tags: ['order-management', 'fulfillment'],
    },
    // Inventory events
    {
      id: 'inventory.stock.adjusted',
      name: 'Stock Adjusted',
      category: ERPEventCategory.UPDATE,
      domain: ERPDomain.INVENTORY,
      direction: 'outbound',
      description: 'Emitted when inventory levels are adjusted',
      version: '1.0.0',
      delivery: 'at-least-once',
      priority: 'normal',
      tags: ['inventory', 'stock'],
    },
    {
      id: 'inventory.low-stock.alert',
      name: 'Low Stock Alert',
      category: ERPEventCategory.NOTIFICATION,
      domain: ERPDomain.INVENTORY,
      direction: 'outbound',
      description: 'Emitted when inventory falls below threshold',
      version: '1.0.0',
      delivery: 'at-least-once',
      priority: 'high',
      tags: ['inventory', 'alert'],
    },
  ],
  metadata: {
    counts: {
      inbound: 1,
      outbound: 10,
    },
    maintainer: 'Platform Architecture Team',
  },
};

/**
 * Get all ERP domains
 */
export function getERPDomains(): ERPDomainManifest[] {
  return ERP_DOMAIN_MANIFESTS;
}

/**
 * Get ERP domain by ID
 */
export function getERPDomainById(domain: ERPDomain): ERPDomainManifest | undefined {
  return ERP_DOMAIN_MANIFESTS.find(d => d.domain === domain);
}

/**
 * Get all ERP events
 */
export function getERPEvents(): ERPEventManifest {
  return ERP_EVENT_MANIFEST;
}
