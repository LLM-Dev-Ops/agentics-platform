/**
 * arch boundaries command - display forbidden paths
 *
 * READ-ONLY: Reads from architecture/FORBIDDEN_PATHS.md
 */

import chalk from 'chalk';
import { readFile } from 'fs/promises';
import { join } from 'path';
import type { ExecutionContext } from '../../types/context.js';
import { ArchitectureParseError } from '../../errors.js';

export interface ArchBoundariesOptions {
  format?: 'json' | 'table';
  class?: string;
}

interface ForbiddenPath {
  source: string;
  target: string;
  rationale: string;
  severity: 'critical' | 'high' | 'medium';
}

/**
 * Execute arch boundaries command
 */
export async function archBoundaries(
  _context: ExecutionContext,
  options: ArchBoundariesOptions = {}
): Promise<void> {
  const forbiddenPath = join(process.cwd(), 'architecture', 'FORBIDDEN_PATHS.md');

  let content: string;
  try {
    content = await readFile(forbiddenPath, 'utf-8');
  } catch (error) {
    throw new ArchitectureParseError(forbiddenPath, 'File not found');
  }

  let paths = parseForbiddenPaths(content);

  // Filter by class if specified
  if (options.class) {
    paths = paths.filter(p =>
      p.source.toLowerCase().includes(options.class!.toLowerCase()) ||
      p.target.toLowerCase().includes(options.class!.toLowerCase())
    );
  }

  if (options.format === 'json') {
    console.log(JSON.stringify(paths, null, 2));
    return;
  }

  displayBoundariesTable(paths);
}

/**
 * Parse forbidden paths from FORBIDDEN_PATHS.md
 */
function parseForbiddenPaths(content: string): ForbiddenPath[] {
  const paths: ForbiddenPath[] = [];

  // Parse tables with forbidden dependencies
  const tableRegex = /\|\s*`?([^`|]+)`?\s*\|\s*([^|]+)\s*\|/g;
  let match: RegExpExecArray | null;

  // Find sections for each repository class
  const sections = content.split(/^### \d+\./m);

  for (const section of sections) {
    const headerMatch = section.match(/^[^(]+\(`([^`]+)`\)/);
    const sourcePattern = headerMatch ? headerMatch[1] : null;

    if (!sourcePattern) continue;

    // Reset regex for each section
    tableRegex.lastIndex = 0;

    while ((match = tableRegex.exec(section)) !== null) {
      const target = match[1]?.trim();
      const rationale = match[2]?.trim();

      // Skip header rows and separators
      if (!target || target === 'Forbidden Dependency' || target.includes('---')) {
        continue;
      }

      paths.push({
        source: sourcePattern,
        target,
        rationale: rationale ?? 'Not specified',
        severity: determineSeverity(rationale ?? ''),
      });
    }
  }

  return paths;
}

/**
 * Determine severity from rationale text
 */
function determineSeverity(text: string): 'critical' | 'high' | 'medium' {
  const lowerText = text.toLowerCase();
  if (lowerText.includes('must never') || lowerText.includes('production')) {
    return 'critical';
  }
  if (lowerText.includes('must not') || lowerText.includes('forbidden')) {
    return 'high';
  }
  return 'medium';
}

/**
 * Display boundaries in table format
 */
function displayBoundariesTable(paths: ForbiddenPath[]): void {
  console.log(chalk.bold('\nForbidden Dependency Paths:\n'));
  console.log(chalk.gray('  Source: architecture/FORBIDDEN_PATHS.md\n'));

  console.log(chalk.gray('  Source                    Target                     Severity'));
  console.log(chalk.gray('  ─'.repeat(35)));

  for (const path of paths) {
    const severityColor =
      path.severity === 'critical' ? chalk.red :
      path.severity === 'high' ? chalk.yellow :
      chalk.gray;

    console.log(
      `  ${path.source.padEnd(26)} ${path.target.padEnd(26)} ${severityColor(path.severity)}`
    );
  }

  console.log();
  console.log(chalk.gray(`  Total: ${paths.length} forbidden paths`));
  console.log();
}
