/**
 * Usage Command for Agentics CLI
 *
 * Resource usage and quota tracking
 */

import { Command } from 'commander';
import { createClient, handleError } from '../client.js';
import { getFormat } from '../config.js';
import {
  formatJson,
  formatTable,
  formatNumber,
  spinner,
  info,
} from '../output.js';
import type { OutputFormat } from '../output.js';
import type { UsagePeriod, UsageGranularity } from '../types.js';

/**
 * Usage current command handler
 */
async function currentHandler(options: { format?: OutputFormat }): Promise<void> {
  try {
    const client = createClient();
    const loadingSpinner = spinner('Fetching current usage...');

    const usage = await client.getCurrentUsage();
    loadingSpinner.succeed('Current usage retrieved');

    const format = options.format || getFormat();

    if (format === 'json') {
      console.log(formatJson(usage));
    } else {
      console.log('\nCurrent Usage:');
      console.log(formatTable(
        [
          {
            resource: 'Requests',
            current: formatNumber(usage.requests_current),
            limit: formatNumber(usage.requests_limit),
            used: `${usage.requests_used_percent.toFixed(1)}%`,
          },
          {
            resource: 'Tokens',
            current: formatNumber(usage.tokens_current),
            limit: formatNumber(usage.tokens_limit),
            used: `${usage.tokens_used_percent.toFixed(1)}%`,
          },
          {
            resource: 'Compute Seconds',
            current: formatNumber(usage.compute_seconds_current),
            limit: usage.compute_seconds_limit
              ? formatNumber(usage.compute_seconds_limit)
              : 'Unlimited',
            used: 'N/A',
          },
        ],
        [
          { header: 'Resource', key: 'resource', width: 20 },
          { header: 'Current', key: 'current', width: 15 },
          { header: 'Limit', key: 'limit', width: 15 },
          { header: 'Used %', key: 'used', width: 10 },
        ]
      ));

      info(`\nQuota resets at: ${usage.resets_at}`);
    }
  } catch (err) {
    handleError(err);
  }
}

/**
 * Usage summary command handler
 */
async function summaryHandler(options: {
  period?: string;
  byResource?: boolean;
  byCore?: boolean;
  format?: OutputFormat;
}): Promise<void> {
  try {
    const client = createClient();
    const loadingSpinner = spinner('Fetching usage summary...');

    const summary = await client.getUsageSummary({
      period: (options.period as UsagePeriod) || 'month',
      by_resource: options.byResource,
      by_core: options.byCore,
    });

    loadingSpinner.succeed('Usage summary retrieved');

    const format = options.format || getFormat();

    if (format === 'json') {
      console.log(formatJson(summary));
    } else {
      console.log(`\nUsage Summary (${summary.period}):`);
      console.log(`Period: ${summary.period_start} to ${summary.period_end}`);
      console.log('');

      console.log(formatTable(
        [
          { metric: 'Total Requests', value: formatNumber(summary.requests) },
          { metric: 'Total Tokens', value: formatNumber(summary.tokens) },
          {
            metric: 'Compute Seconds',
            value: formatNumber(summary.compute_seconds),
          },
        ],
        [
          { header: 'Metric', key: 'metric', width: 20 },
          { header: 'Value', key: 'value', width: 20 },
        ]
      ));

      if (summary.by_resource && Object.keys(summary.by_resource).length > 0) {
        console.log('\nBy Resource:');
        const resourceData = Object.entries(summary.by_resource).map(
          ([resource, data]: [string, any]) => ({
            resource,
            requests: formatNumber(data.requests),
            tokens: data.tokens ? formatNumber(data.tokens) : 'N/A',
            compute: data.compute_seconds
              ? formatNumber(data.compute_seconds)
              : 'N/A',
          })
        );

        console.log(formatTable(resourceData, [
          { header: 'Resource', key: 'resource', width: 25 },
          { header: 'Requests', key: 'requests', width: 15 },
          { header: 'Tokens', key: 'tokens', width: 15 },
          { header: 'Compute (s)', key: 'compute', width: 15 },
        ]));
      }

      if (summary.by_core && Object.keys(summary.by_core).length > 0) {
        console.log('\nBy Core:');
        const coreData = Object.entries(summary.by_core).map(
          ([core, data]: [string, any]) => ({
            core,
            requests: formatNumber(data.requests),
            tokens: data.tokens ? formatNumber(data.tokens) : 'N/A',
            compute: data.compute_seconds
              ? formatNumber(data.compute_seconds)
              : 'N/A',
          })
        );

        console.log(formatTable(coreData, [
          { header: 'Core', key: 'core', width: 20 },
          { header: 'Requests', key: 'requests', width: 15 },
          { header: 'Tokens', key: 'tokens', width: 15 },
          { header: 'Compute (s)', key: 'compute', width: 15 },
        ]));
      }
    }
  } catch (err) {
    handleError(err);
  }
}

/**
 * Usage history command handler
 */
async function historyHandler(options: {
  start?: string;
  end?: string;
  granularity?: string;
  resource?: string;
  core?: string;
  format?: OutputFormat;
}): Promise<void> {
  try {
    const client = createClient();

    if (!options.start || !options.end) {
      throw new Error('--start and --end are required');
    }

    const loadingSpinner = spinner('Fetching usage history...');

    const history = await client.getUsageHistory({
      start: options.start,
      end: options.end,
      granularity: (options.granularity as UsageGranularity) || 'day',
      resource: options.resource,
      core: options.core,
    });

    loadingSpinner.succeed('Usage history retrieved');

    const format = options.format || getFormat();

    if (format === 'json') {
      console.log(formatJson(history));
    } else {
      console.log(`\nUsage History (${history.granularity} buckets):`);
      console.log(`Period: ${history.start_date} to ${history.end_date}`);
      console.log('');

      if (history.buckets.length === 0) {
        info('No usage data in this period');
        return;
      }

      console.log(formatTable(
        history.buckets.map((bucket: any) => ({
          timestamp: new Date(bucket.timestamp).toLocaleString(),
          requests: formatNumber(bucket.requests),
          tokens: formatNumber(bucket.tokens),
          compute: bucket.compute_seconds
            ? formatNumber(bucket.compute_seconds)
            : 'N/A',
        })),
        [
          { header: 'Timestamp', key: 'timestamp', width: 25 },
          { header: 'Requests', key: 'requests', width: 15 },
          { header: 'Tokens', key: 'tokens', width: 15 },
          { header: 'Compute (s)', key: 'compute', width: 15 },
        ]
      ));

      console.log('\nTotals:');
      console.log(formatTable(
        [
          { metric: 'Total Requests', value: formatNumber(history.totals.requests) },
          { metric: 'Total Tokens', value: formatNumber(history.totals.tokens) },
          {
            metric: 'Total Compute Seconds',
            value: formatNumber(history.totals.compute_seconds),
          },
        ],
        [
          { header: 'Metric', key: 'metric', width: 25 },
          { header: 'Value', key: 'value', width: 20 },
        ]
      ));
    }
  } catch (err) {
    handleError(err);
  }
}

/**
 * Create and configure the usage command
 */
export function createUsageCommand(): Command {
  const cmd = new Command('usage')
    .description('View resource usage and quotas');

  cmd
    .command('current')
    .description('View current usage and quotas')
    .option('--format <format>', 'Output format (json, table)', 'table')
    .action(currentHandler);

  cmd
    .command('summary')
    .description('View usage summary for a period')
    .option(
      '--period <period>',
      'Time period (hourly, daily, weekly, monthly, all_time)',
      'monthly'
    )
    .option('--by-resource', 'Include breakdown by resource type')
    .option('--by-core', 'Include breakdown by Layer 3 core')
    .option('--format <format>', 'Output format (json, table)', 'table')
    .action(summaryHandler);

  cmd
    .command('history')
    .description('View usage history over time')
    .option('--start <date>', 'Start date (ISO 8601 format)')
    .option('--end <date>', 'End date (ISO 8601 format)')
    .option(
      '--granularity <granularity>',
      'Time bucket granularity (hour, day, week, month)',
      'day'
    )
    .option('--resource <resource>', 'Filter by resource type')
    .option('--core <core>', 'Filter by Layer 3 core')
    .option('--format <format>', 'Output format (json, table)', 'table')
    .action(historyHandler);

  return cmd;
}
