/**
 * artifact plan command - generate execution plan from spec
 *
 * This command generates an artifact (execution plan) from a specification.
 * It does NOT execute anything - it produces a plan artifact for review.
 */

import chalk from 'chalk';
import { readFile } from 'fs/promises';
import { randomUUID } from 'crypto';
import type { ExecutionContext } from '../../types/context.js';
import { forward } from '../../delegation/forwarder.js';
import { executeDryRun } from '../../delegation/dry-run.js';
import { generateProvenanceStamp, formatProvenanceAsJson } from '../../delegation/provenance.js';

export interface ArtifactPlanOptions {
  dryRun?: boolean;
  output?: string;
  format?: 'json' | 'yaml';
}

/**
 * Execute artifact plan command
 */
export async function artifactPlan(
  specPath: string,
  context: ExecutionContext,
  options: ArtifactPlanOptions = {}
): Promise<void> {
  if (context.dryRun) {
    executeDryRun('artifact plan', [specPath], context, [
      {
        action: 'Read',
        target: 'Specification file',
        details: { path: specPath },
      },
      {
        action: 'Validate',
        target: 'Specification schema',
        details: { format: 'agentics-spec-v1' },
      },
      {
        action: 'Generate',
        target: 'Execution plan artifact',
        details: {
          orgId: context.org.orgId,
          envId: context.env.envId,
        },
      },
      {
        action: 'Stamp',
        target: 'Provenance metadata',
        details: { correlationId: context.correlationId },
      },
      {
        action: 'Output',
        target: options.output ?? 'stdout',
        details: { format: options.format ?? 'json' },
      },
    ]);
    return;
  }

  // Read and validate spec exists
  try {
    await readFile(specPath, 'utf-8');
  } catch (error) {
    console.error(chalk.red(`Error: Cannot read specification file: ${specPath}`));
    process.exit(1);
  }

  // Delegate to agentics CLI for actual plan generation
  const args = [
    'artifact', 'plan', specPath,
    ...(options.output ? ['--output', options.output] : []),
    ...(options.format ? ['--format', options.format] : []),
  ];

  await forward('artifact', ['plan', specPath, ...args.slice(3)], context);
}

/**
 * Generate a local plan artifact (for when CLI delegation is not available)
 */
export async function generateLocalPlan(
  specPath: string,
  context: ExecutionContext
): Promise<{ artifactId: string; provenance: string }> {
  const specContent = await readFile(specPath, 'utf-8');
  const artifactId = `plan-${randomUUID().slice(0, 8)}`;

  const provenance = await generateProvenanceStamp(specContent, context);

  return {
    artifactId,
    provenance: formatProvenanceAsJson(provenance),
  };
}
