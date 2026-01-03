/**
 * arch repos command - display repository classifications
 *
 * READ-ONLY: Reads from architecture/REPO_CLASSIFICATION.md
 */

import chalk from 'chalk';
import { readFile } from 'fs/promises';
import { join } from 'path';
import type { ExecutionContext } from '../../types/context.js';
import { ArchitectureParseError } from '../../errors.js';

export interface ArchReposOptions {
  format?: 'json' | 'table';
  class?: string;
  layer?: number;
}

interface RepoClassification {
  name: string;
  class: string;
  layer: number | null;
  allowedDeps: string[];
  forbiddenDeps: string[];
}

/**
 * Execute arch repos command
 */
export async function archRepos(
  _context: ExecutionContext,
  options: ArchReposOptions = {}
): Promise<void> {
  const classPath = join(process.cwd(), 'architecture', 'REPO_CLASSIFICATION.md');

  let content: string;
  try {
    content = await readFile(classPath, 'utf-8');
  } catch (error) {
    throw new ArchitectureParseError(classPath, 'File not found');
  }

  let repos = parseRepoClassifications(content);

  // Filter by class if specified
  if (options.class) {
    repos = repos.filter(r => r.class.toLowerCase() === options.class!.toLowerCase());
  }

  // Filter by layer if specified
  if (options.layer !== undefined) {
    repos = repos.filter(r => r.layer === options.layer);
  }

  if (options.format === 'json') {
    console.log(JSON.stringify(repos, null, 2));
    return;
  }

  displayReposTable(repos);
}

/**
 * Parse repository classifications from REPO_CLASSIFICATION.md
 */
function parseRepoClassifications(content: string): RepoClassification[] {
  const repos: RepoClassification[] = [];

  // Parse the repository tables
  const repoTableRegex = /\|\s*`([^`]+)`\s*\|\s*(\w+)\s*\|\s*(\d+|N\/A)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|/g;
  let match: RegExpExecArray | null;

  while ((match = repoTableRegex.exec(content)) !== null) {
    const repoName = match[1];
    const repoClass = match[2];
    const layerStr = match[3];
    const allowed = match[4]?.trim();
    const forbidden = match[5]?.trim();

    if (!repoName || repoName.includes('---') || repoName === 'Repository') {
      continue;
    }

    repos.push({
      name: repoName,
      class: repoClass ?? 'Unknown',
      layer: layerStr === 'N/A' ? null : parseInt(layerStr ?? '0', 10),
      allowedDeps: parseDepList(allowed ?? ''),
      forbiddenDeps: parseDepList(forbidden ?? ''),
    });
  }

  return repos;
}

/**
 * Parse dependency list from table cell
 */
function parseDepList(deps: string): string[] {
  if (!deps || deps === 'None' || deps === '-') {
    return [];
  }
  return deps.split(',').map(d => d.trim()).filter(Boolean);
}

/**
 * Display repos in table format
 */
function displayReposTable(repos: RepoClassification[]): void {
  console.log(chalk.bold('\nRepository Classifications:\n'));
  console.log(chalk.gray('  Source: architecture/REPO_CLASSIFICATION.md\n'));

  console.log(chalk.gray('  Repository                    Class          Layer'));
  console.log(chalk.gray('  ─'.repeat(30)));

  for (const repo of repos) {
    const classColor =
      repo.class === 'Platform' ? chalk.green :
      repo.class === 'Core' ? chalk.yellow :
      repo.class === 'Infrastructure' ? chalk.cyan :
      repo.class === 'Simulation' ? chalk.magenta :
      chalk.white;

    const layerStr = repo.layer !== null ? `Layer ${repo.layer}` : 'N/A';

    console.log(
      `  ${repo.name.padEnd(30)} ${classColor(repo.class.padEnd(14))} ${layerStr}`
    );
  }

  console.log();
  console.log(chalk.gray(`  Total: ${repos.length} repositories`));
  console.log();
}
