/**
 * Architecture introspection commands
 *
 * ALL commands in this module are READ-ONLY filesystem operations.
 * They read from architecture/*.md files and never modify anything.
 *
 * Commands:
 * - layers: Display layer definitions (DEPENDENCY_GRAPH.md)
 * - boundaries: Display forbidden paths (FORBIDDEN_PATHS.md)
 * - repos: Display repository classifications (REPO_CLASSIFICATION.md)
 * - validate: Validate path against architecture rules
 */

export { archLayers } from './layers.js';
export { archBoundaries } from './boundaries.js';
export { archRepos } from './repos.js';
export { archValidate } from './validate.js';
