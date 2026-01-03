/**
 * Artifact commands
 *
 * These commands are artifact/lifecycle-oriented:
 * - plan: Generate execution plan artifact
 * - inspect: Inspect artifact metadata
 * - diff: Compare artifacts
 * - list: List artifacts in context
 *
 * Note: These do NOT imply runtime execution or control.
 */

export { artifactPlan } from './plan.js';
export { artifactInspect } from './inspect.js';
export { artifactDiff } from './diff.js';
export { artifactList } from './list.js';
