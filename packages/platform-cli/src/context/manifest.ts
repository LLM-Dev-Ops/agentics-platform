/**
 * Local manifest operations
 * Reads and validates .agentics-manifest.json files
 */

import { readFile } from 'fs/promises';
import { join } from 'path';
import type { ManifestFile } from './types.js';

const MANIFEST_FILENAME = '.agentics-manifest.json';

/**
 * Find and read manifest file, searching up the directory tree
 */
export async function findManifest(startDir: string): Promise<ManifestFile | null> {
  let currentDir = startDir;
  const root = '/';

  while (currentDir !== root) {
    try {
      const manifestPath = join(currentDir, MANIFEST_FILENAME);
      const content = await readFile(manifestPath, 'utf-8');
      const manifest = JSON.parse(content) as unknown;

      if (isValidManifest(manifest)) {
        return manifest;
      }
    } catch {
      // File not found or invalid, continue searching
    }

    // Move up one directory
    const parentDir = join(currentDir, '..');
    if (parentDir === currentDir) break;
    currentDir = parentDir;
  }

  return null;
}

/**
 * Validate manifest structure
 */
function isValidManifest(value: unknown): value is ManifestFile {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;

  if (obj['version'] !== '1.0') return false;

  if (obj['org'] !== undefined) {
    const org = obj['org'] as Record<string, unknown>;
    if (typeof org['id'] !== 'string') return false;
  }

  if (obj['env'] !== undefined) {
    const env = obj['env'] as Record<string, unknown>;
    if (typeof env['id'] !== 'string') return false;
  }

  return true;
}

/**
 * Get manifest from current working directory
 */
export async function getManifest(): Promise<ManifestFile | null> {
  return findManifest(process.cwd());
}
