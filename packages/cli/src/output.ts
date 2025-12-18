/**
 * Output Formatting Utilities for Agentics CLI
 *
 * Provides functions for formatting CLI output including tables, JSON,
 * spinners, and styled messages using chalk and ora.
 */

import chalk from 'chalk';
import ora, { Ora } from 'ora';

/**
 * Output format type
 */
export type OutputFormat = 'json' | 'table';

/**
 * Column definition for table output
 */
export interface TableColumn {
  /** Column header text */
  header: string;
  /** Property key to extract from data objects */
  key: string;
  /** Optional width for column */
  width?: number;
  /** Optional formatter function */
  formatter?: (value: unknown) => string;
}

/**
 * Format data as a table with ASCII borders
 *
 * @param data - Array of objects to display
 * @param columns - Column definitions
 * @returns Formatted table string
 */
export function formatTable(
  data: Record<string, unknown>[],
  columns: TableColumn[]
): string {
  if (data.length === 0) {
    return chalk.dim('No data to display');
  }

  // Calculate column widths
  const widths = columns.map((col) => {
    const headerWidth = col.header.length;
    const maxDataWidth = Math.max(
      ...data.map((row) => {
        const value = row[col.key];
        const formatted = col.formatter
          ? col.formatter(value)
          : String(value ?? '');
        return formatted.length;
      })
    );
    return col.width ?? Math.max(headerWidth, maxDataWidth);
  });

  // Build separator line
  const separator =
    '+' + widths.map((w) => '-'.repeat(w + 2)).join('+') + '+';

  // Build header row
  const headerRow =
    '|' +
    columns
      .map((col, i) => ' ' + col.header.padEnd(widths[i]) + ' ')
      .join('|') +
    '|';

  // Build data rows
  const dataRows = data.map((row) => {
    return (
      '|' +
      columns
        .map((col, i) => {
          const value = row[col.key];
          const formatted = col.formatter
            ? col.formatter(value)
            : String(value ?? '');
          return ' ' + formatted.padEnd(widths[i]) + ' ';
        })
        .join('|') +
      '|'
    );
  });

  // Combine all parts
  return [
    separator,
    chalk.bold(headerRow),
    separator,
    ...dataRows,
    separator,
  ].join('\n');
}

/**
 * Format data as pretty JSON
 *
 * @param data - Data to format as JSON
 * @returns Formatted JSON string
 */
export function formatJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

/**
 * Create and start a spinner
 *
 * @param message - Spinner message
 * @returns Ora spinner instance
 */
export function spinner(message: string): Ora {
  return ora(message).start();
}

/**
 * Display a success message
 *
 * @param message - Success message to display
 */
export function success(message: string): void {
  console.log(chalk.green('✓') + ' ' + message);
}

/**
 * Display an error message
 *
 * @param message - Error message to display
 */
export function error(message: string): void {
  console.error(chalk.red('✗') + ' ' + message);
}

/**
 * Display a warning message
 *
 * @param message - Warning message to display
 */
export function warning(message: string): void {
  console.log(chalk.yellow('⚠') + ' ' + message);
}

/**
 * Display an info message
 *
 * @param message - Info message to display
 */
export function info(message: string): void {
  console.log(chalk.blue('ℹ') + ' ' + message);
}

/**
 * Display data in the specified format
 *
 * @param data - Data to display
 * @param format - Output format ('json' or 'table')
 * @param columns - Column definitions for table format
 */
export function display(
  data: unknown,
  format: OutputFormat = 'table',
  columns?: TableColumn[]
): void {
  if (format === 'json') {
    console.log(formatJson(data));
  } else if (format === 'table' && columns) {
    const arrayData = Array.isArray(data) ? data : [data];
    console.log(formatTable(arrayData as Record<string, unknown>[], columns));
  } else {
    // Fallback to JSON if table columns not provided
    console.log(formatJson(data));
  }
}

/**
 * Format a timestamp in a human-readable way
 *
 * @param timestamp - ISO 8601 timestamp
 * @returns Formatted timestamp string
 */
export function formatTimestamp(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleString();
  } catch {
    return timestamp;
  }
}

/**
 * Format bytes as human-readable size
 *
 * @param bytes - Number of bytes
 * @returns Formatted size string (e.g., "1.5 MB")
 */
export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Format a number with thousands separators
 *
 * @param num - Number to format
 * @returns Formatted number string
 */
export function formatNumber(num: number): string {
  return num.toLocaleString();
}

/**
 * Truncate a string to a maximum length
 *
 * @param str - String to truncate
 * @param maxLength - Maximum length
 * @returns Truncated string with ellipsis if needed
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.slice(0, maxLength - 3) + '...';
}
