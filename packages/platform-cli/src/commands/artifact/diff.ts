/**
 * artifact diff command - compare two artifacts
 *
 * Read-only comparison of artifact content and metadata.
 */

import chalk from 'chalk';
import type { ExecutionContext } from '../../types/context.js';
import { forward } from '../../delegation/forwarder.js';
import { executeDryRun } from '../../delegation/dry-run.js';

export interface ArtifactDiffOptions {
  format?: 'json' | 'unified' | 'side-by-side';
  showMetadata?: boolean;
}

/**
 * Execute artifact diff command
 */
export async function artifactDiff(
  artifactA: string,
  artifactB: string,
  context: ExecutionContext,
  options: ArtifactDiffOptions = {}
): Promise<void> {
  if (context.dryRun) {
    executeDryRun('artifact diff', [artifactA, artifactB], context, [
      {
        action: 'Fetch',
        target: 'Artifact A',
        details: { artifactId: artifactA },
      },
      {
        action: 'Fetch',
        target: 'Artifact B',
        details: { artifactId: artifactB },
      },
      {
        action: 'Compare',
        target: 'Artifact content',
        details: {
          format: options.format ?? 'unified',
          includeMetadata: options.showMetadata ?? false,
        },
      },
      {
        action: 'Display',
        target: 'Diff output',
        details: { format: options.format ?? 'unified' },
      },
    ]);
    return;
  }

  // Validate artifact IDs
  if (!artifactA || artifactA.length < 4) {
    console.error(chalk.red('Error: Invalid artifact A ID'));
    process.exit(1);
  }
  if (!artifactB || artifactB.length < 4) {
    console.error(chalk.red('Error: Invalid artifact B ID'));
    process.exit(1);
  }

  // Delegate to agentics CLI
  const args = [
    'diff', artifactA, artifactB,
    ...(options.format ? ['--format', options.format] : []),
    ...(options.showMetadata ? ['--metadata'] : []),
  ];

  await forward('artifact', args, context);
}
