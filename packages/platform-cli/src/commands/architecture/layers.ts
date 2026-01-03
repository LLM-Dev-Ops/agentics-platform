/**
 * arch layers command - display layer definitions
 *
 * READ-ONLY: Reads from architecture/DEPENDENCY_GRAPH.md
 */

import chalk from 'chalk';
import { readFile } from 'fs/promises';
import { join } from 'path';
import type { ExecutionContext } from '../../types/context.js';
import { ArchitectureParseError } from '../../errors.js';

export interface ArchLayersOptions {
  format?: 'json' | 'table';
}

interface LayerDefinition {
  layer: number;
  name: string;
  description: string;
  components: string[];
}

/**
 * Execute arch layers command
 */
export async function archLayers(
  _context: ExecutionContext,
  options: ArchLayersOptions = {}
): Promise<void> {
  const graphPath = join(process.cwd(), 'architecture', 'DEPENDENCY_GRAPH.md');

  let content: string;
  try {
    content = await readFile(graphPath, 'utf-8');
  } catch (error) {
    throw new ArchitectureParseError(graphPath, 'File not found');
  }

  const layers = parseLayerDefinitions(content);

  if (options.format === 'json') {
    console.log(JSON.stringify(layers, null, 2));
    return;
  }

  displayLayersTable(layers);
}

/**
 * Parse layer definitions from DEPENDENCY_GRAPH.md
 */
function parseLayerDefinitions(content: string): LayerDefinition[] {
  const layers: LayerDefinition[] = [];

  // Find layer definition sections
  const layerPatterns = [
    { layer: 5, pattern: /### Layer 5: ([^\n]+)\n\n\*\*Description\*\*: ([^\n]+)/s },
    { layer: 4, pattern: /### Layer 4: ([^\n]+)\n\n\*\*Description\*\*: ([^\n]+)/s },
    { layer: 3, pattern: /### Layer 3: ([^\n]+)\n\n\*\*Description\*\*: ([^\n]+)/s },
    { layer: 2, pattern: /### Layer 2: ([^\n]+)\n\n\*\*Description\*\*: ([^\n]+)/s },
    { layer: 1, pattern: /### Layer 1: ([^\n]+)\n\n\*\*Description\*\*: ([^\n]+)/s },
  ];

  for (const { layer, pattern } of layerPatterns) {
    const match = content.match(pattern);
    if (match) {
      layers.push({
        layer,
        name: match[1]?.trim() ?? `Layer ${layer}`,
        description: match[2]?.trim() ?? '',
        components: extractComponents(content, layer),
      });
    }
  }

  return layers.sort((a, b) => b.layer - a.layer);
}

/**
 * Extract components for a layer
 */
function extractComponents(content: string, layer: number): string[] {
  const components: string[] = [];

  // Simple extraction based on layer
  const componentPatterns: Record<number, RegExp> = {
    5: /CLI.*SDK.*Web UI/i,
    4: /API Gateway.*Identity Service/i,
    3: /LLM-\w+-Core/g,
    2: /services-\w+/g,
    1: /RuvVector/i,
  };

  const pattern = componentPatterns[layer];
  if (pattern) {
    const matches = content.match(pattern);
    if (matches) {
      components.push(...matches);
    }
  }

  return components;
}

/**
 * Display layers in table format
 */
function displayLayersTable(layers: LayerDefinition[]): void {
  console.log(chalk.bold('\nArchitecture Layers:\n'));
  console.log(chalk.gray('  Source: architecture/DEPENDENCY_GRAPH.md\n'));

  for (const layer of layers) {
    const layerColor =
      layer.layer === 5 ? chalk.blue :
      layer.layer === 4 ? chalk.green :
      layer.layer === 3 ? chalk.yellow :
      layer.layer === 2 ? chalk.cyan :
      chalk.magenta;

    console.log(`  ${layerColor.bold(`Layer ${layer.layer}`)}: ${chalk.white(layer.name)}`);
    console.log(`  ${chalk.gray(layer.description)}`);
    if (layer.components.length > 0) {
      console.log(`  ${chalk.gray('Components:')} ${layer.components.slice(0, 3).join(', ')}${layer.components.length > 3 ? '...' : ''}`);
    }
    console.log();
  }
}
