/**
 * artifact inspect command - inspect artifact metadata
 *
 * Read-only inspection of artifact metadata including provenance,
 * dependencies, and lifecycle state.
 */

import chalk from 'chalk';
import type { ExecutionContext } from '../../types/context.js';
import { forward } from '../../delegation/forwarder.js';
import { executeDryRun } from '../../delegation/dry-run.js';

export interface ArtifactInspectOptions {
  format?: 'json' | 'table';
  showProvenance?: boolean;
  showDependencies?: boolean;
}

/**
 * Execute artifact inspect command
 */
export async function artifactInspect(
  artifactId: string,
  context: ExecutionContext,
  options: ArtifactInspectOptions = {}
): Promise<void> {
  if (context.dryRun) {
    executeDryRun('artifact inspect', [artifactId], context, [
      {
        action: 'Query',
        target: 'Artifact metadata',
        details: { artifactId },
      },
      {
        action: 'Fetch',
        target: 'Provenance stamp',
        details: { showProvenance: options.showProvenance ?? true },
      },
      {
        action: 'Resolve',
        target: 'Dependencies',
        details: { showDependencies: options.showDependencies ?? false },
      },
      {
        action: 'Display',
        target: 'Artifact details',
        details: { format: options.format ?? 'table' },
      },
    ]);
    return;
  }

  // Validate artifact ID format
  if (!artifactId || artifactId.length < 4) {
    console.error(chalk.red('Error: Invalid artifact ID'));
    process.exit(1);
  }

  // Delegate to agentics CLI
  const args = [
    'inspect', artifactId,
    ...(options.format ? ['--format', options.format] : []),
    ...(options.showProvenance !== false ? ['--provenance'] : []),
    ...(options.showDependencies ? ['--dependencies'] : []),
  ];

  await forward('artifact', args, context);
}

/**
 * Display artifact metadata in table format
 */
export function displayArtifactTable(artifact: {
  id: string;
  type: string;
  createdAt: string;
  status: string;
  provenance?: {
    cliVersion: string;
    generatedAt: string;
    contentHash: string;
  };
}): void {
  console.log(chalk.bold('\nArtifact Details:\n'));
  console.log(`  ${chalk.cyan('ID:')}         ${artifact.id}`);
  console.log(`  ${chalk.cyan('Type:')}       ${artifact.type}`);
  console.log(`  ${chalk.cyan('Created:')}    ${artifact.createdAt}`);
  console.log(`  ${chalk.cyan('Status:')}     ${artifact.status}`);

  if (artifact.provenance) {
    console.log(chalk.bold('\n  Provenance:'));
    console.log(`    ${chalk.gray('CLI Version:')}  ${artifact.provenance.cliVersion}`);
    console.log(`    ${chalk.gray('Generated:')}    ${artifact.provenance.generatedAt}`);
    console.log(`    ${chalk.gray('Content Hash:')} ${artifact.provenance.contentHash}`);
  }

  console.log();
}
