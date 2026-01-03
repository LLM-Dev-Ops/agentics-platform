# Agentics Platform CLI Implementation Plan (Corrected)

**Version**: 1.1 (Architectural Corrections Applied)
**Status**: Pre-Implementation Review
**Last Updated**: 2025-01-03

---

## Architectural Corrections Applied

This revision applies the following minimum required corrections before implementation:

| Correction | Original | Corrected |
|------------|----------|-----------|
| Simulation commands | `start`, `stop`, `status` (implies execution control) | `plan`, `inspect`, `diff`, `promote` (artifact/lifecycle-oriented) |
| Policy enforcement | Re-encodes rules in code | Validates against existing architecture docs (filesystem-based) |
| Delegation layer | Semantic transformation | Pure call-forwarding to @agentics/cli |
| Promotion logic | In `env promote` command | Relocated to `intent promote` lifecycle handling |
| Architecture commands | Mixed read/write | Read-only filesystem introspection only |

---

## Architecture Compliance

Validated against:
- `architecture/DEPENDENCY_GRAPH.md` v1.2
- `architecture/FORBIDDEN_PATHS.md` v1.1
- `architecture/REPO_CLASSIFICATION.md` v1.0

**Layer Placement**: Layer 5 (External Consumer)
**Allowed Dependencies**: `@agentics/cli`, `@agentics/sdk`, `@agentics/shared`, Layer 4 API
**Forbidden Dependencies**: Layer 3 cores, Layer 2 services, infra-*, simulation repos directly

---

## Package Structure

```
packages/platform-cli/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                    # Library exports
│   ├── cli.ts                      # Thin binary entry point
│   ├── context/                    # Module: Context Resolution
│   │   ├── index.ts
│   │   ├── resolver.ts             # Org/env context resolution
│   │   ├── manifest.ts             # Local manifest operations
│   │   └── types.ts
│   ├── policy/                     # Module: Policy Enforcement
│   │   ├── index.ts
│   │   ├── loader.ts               # CORRECTED: Loads rules from architecture/*.md
│   │   ├── validator.ts            # Validates against loaded rules (no re-encoding)
│   │   └── types.ts
│   ├── routing/                    # Module: Command Routing
│   │   ├── index.ts
│   │   ├── dispatcher.ts           # Route commands through validation
│   │   └── interceptor.ts          # Pre/post execution hooks
│   ├── delegation/                 # Module: Delegation to @agentics/cli
│   │   ├── index.ts
│   │   ├── forwarder.ts            # CORRECTED: Pure call-forwarding (no transformation)
│   │   ├── dry-run.ts              # Dry-run wrapper
│   │   └── provenance.ts           # Artifact stamping
│   ├── commands/                   # Command implementations
│   │   ├── org/                    # Org commands (list, switch, current)
│   │   ├── env/                    # CORRECTED: list, switch, current only (no promote)
│   │   ├── artifact/               # CORRECTED: Artifact operations (plan, inspect, diff)
│   │   ├── intent/                 # CORRECTED: Lifecycle + promote (submit, approve, reject, promote)
│   │   └── architecture/           # CORRECTED: Read-only introspection only
│   ├── types/
│   │   ├── context.ts
│   │   ├── lifecycle.ts
│   │   └── provenance.ts
│   └── errors.ts
└── tests/
```

---

## Module Boundaries (Corrected)

### 1. Context Resolution (`src/context/`)
- Resolves org/env context from: CLI flags → env vars → manifest → stored config
- Validates context against API before execution
- Fails fast with explicit error if context missing
- **No changes from original**

### 2. Policy Enforcement (`src/policy/`)
**CORRECTED**: Does not re-encode rules. Instead:
- `loader.ts` reads and parses rules from:
  - `architecture/DEPENDENCY_GRAPH.md`
  - `architecture/FORBIDDEN_PATHS.md`
  - `architecture/REPO_CLASSIFICATION.md`
- `validator.ts` validates operations against loaded rules
- Rules are never duplicated in code; always read from source documents
- Caches parsed rules with file modification timestamps for invalidation

### 3. Command Routing (`src/routing/`)
- Routes commands through validation pipeline
- Executes pre-hooks: auth check, context resolution, policy validation
- Executes post-hooks: provenance stamping, audit logging
- **No changes from original**

### 4. Delegation (`src/delegation/`)
**CORRECTED**: Pure call-forwarding without semantic transformation:
- `forwarder.ts` (renamed from executor.ts) forwards calls directly to @agentics/cli
- No parameter transformation or enrichment beyond context attachment
- No wrapping of @agentics/cli responses
- Dry-run remains as pass-through flag

---

## Command Surface (Corrected)

```bash
# Organization Context
agentics-platform org list [--format json|table]
agentics-platform org switch <org-id>
agentics-platform org current

# Environment Context
# CORRECTED: Removed 'env promote' - promotion is now intent lifecycle
agentics-platform env list [--org <org-id>]
agentics-platform env switch <env-id>
agentics-platform env current

# Artifact Operations (CORRECTED: renamed from 'simulation')
# These are artifact/lifecycle-oriented, not execution control
agentics-platform artifact plan <spec-path> [--dry-run]     # Generate execution plan
agentics-platform artifact inspect <artifact-id>            # Inspect artifact metadata
agentics-platform artifact diff <artifact-a> <artifact-b>   # Compare artifacts
agentics-platform artifact list [--env <env-id>]            # List artifacts in context

# Intent Lifecycle (CORRECTED: includes promote)
agentics-platform intent submit --type <type> --target <target> [--dry-run]
agentics-platform intent status <intent-id>
agentics-platform intent approve <intent-id>
agentics-platform intent reject <intent-id> --reason <text>
agentics-platform intent list [--status pending|approved|rejected]
agentics-platform intent promote <source-env> <target-env> [--dry-run]  # MOVED from env

# Architecture Introspection (CORRECTED: read-only, filesystem-based)
agentics-platform arch layers                               # Read architecture/DEPENDENCY_GRAPH.md
agentics-platform arch boundaries                           # Read architecture/FORBIDDEN_PATHS.md
agentics-platform arch repos                                # Read architecture/REPO_CLASSIFICATION.md
agentics-platform arch validate <path>                      # Validate path against loaded rules

# Global Options
--org <org-id>          Override org context
--env <env-id>          Override env context
--dry-run               Show what would happen without executing
--format json|table     Output format
```

---

## Key Type Corrections

```typescript
// Delegation is pure forwarding - no semantic types needed
// forwarder.ts signature:
export async function forward(
  command: string,
  args: string[],
  context: ExecutionContext
): Promise<void>;  // Returns void - output handled by @agentics/cli

// Policy loads from documents, not encoded
interface LoadedPolicy {
  source: string;              // Path to architecture/*.md
  loadedAt: string;            // Timestamp
  checksum: string;            // For cache invalidation
  rules: PolicyRule[];         // Parsed from document
}

interface PolicyRule {
  id: string;
  type: 'forbidden_path' | 'layer_boundary' | 'repo_classification';
  pattern: string;             // From document, not re-encoded
  layer?: number;
  description: string;
}
```

---

## Delegation Pattern (Corrected)

```typescript
// src/delegation/forwarder.ts
// CORRECTED: Pure call-forwarding without transformation

import { spawn } from 'child_process';

/**
 * Pure call-forwarder to @agentics/cli
 * No semantic transformation - passes arguments directly
 */
export async function forward(
  command: string,
  args: string[],
  context: ExecutionContext
): Promise<void> {
  // Attach context as environment variables only
  const env = {
    ...process.env,
    AGENTICS_ORG: context.org.orgId,
    AGENTICS_ENV: context.env.envId,
    AGENTICS_CORRELATION_ID: context.correlationId,
  };

  // Forward directly to agentics CLI - no transformation
  const child = spawn('agentics', [command, ...args], {
    env,
    stdio: 'inherit',  // Pass through all I/O
  });

  return new Promise((resolve, reject) => {
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed with code ${code}`));
    });
  });
}
```

---

## Policy Loader Pattern (Corrected)

```typescript
// src/policy/loader.ts
// CORRECTED: Loads rules from architecture docs, never re-encodes

import { readFile } from 'fs/promises';
import { join } from 'path';

const ARCHITECTURE_DIR = 'architecture';
const POLICY_DOCS = [
  'DEPENDENCY_GRAPH.md',
  'FORBIDDEN_PATHS.md',
  'REPO_CLASSIFICATION.md',
];

/**
 * Load policy rules directly from architecture documents
 * Rules are parsed, never re-encoded or duplicated
 */
export async function loadPolicies(baseDir: string): Promise<LoadedPolicy[]> {
  const policies: LoadedPolicy[] = [];

  for (const doc of POLICY_DOCS) {
    const path = join(baseDir, ARCHITECTURE_DIR, doc);
    const content = await readFile(path, 'utf-8');
    const rules = parseRulesFromMarkdown(content, doc);

    policies.push({
      source: path,
      loadedAt: new Date().toISOString(),
      checksum: computeChecksum(content),
      rules,
    });
  }

  return policies;
}

// Parser extracts rules from markdown tables/sections
function parseRulesFromMarkdown(content: string, source: string): PolicyRule[] {
  // Parse forbidden path tables, layer definitions, repo classifications
  // Returns structured rules without re-encoding semantics
}
```

---

## Architecture Commands (Corrected)

All architecture commands are **read-only filesystem introspection**:

```typescript
// src/commands/architecture/layers.ts
// CORRECTED: Reads and displays, never modifies

export async function layersCommand(): Promise<void> {
  const graphPath = join(process.cwd(), 'architecture', 'DEPENDENCY_GRAPH.md');
  const content = await readFile(graphPath, 'utf-8');

  // Extract and display layer definitions section
  const layers = extractSection(content, '## Layer Definitions');
  display(layers, getFormat());
}

// src/commands/architecture/validate.ts
// CORRECTED: Validates against loaded rules, read-only

export async function validateCommand(path: string): Promise<void> {
  const policies = await loadPolicies(process.cwd());
  const violations = validatePath(path, policies);

  if (violations.length > 0) {
    displayViolations(violations);
    process.exit(1);
  }

  success(`Path "${path}" complies with architecture constraints`);
}
```

---

## Implementation Phases (Unchanged)

Phase ordering and file structure unchanged per requirements:

### Phase 1: Package Setup
- `packages/platform-cli/package.json`
- `packages/platform-cli/tsconfig.json`
- `packages/platform-cli/src/types/`
- `packages/platform-cli/src/errors.ts`

### Phase 2: Context Resolution
- `packages/platform-cli/src/context/`

### Phase 3: Policy Enforcement (Corrected Implementation)
- `packages/platform-cli/src/policy/loader.ts` (reads from docs)
- `packages/platform-cli/src/policy/validator.ts` (validates, no re-encoding)
- `packages/platform-cli/src/policy/types.ts`
- `packages/platform-cli/src/policy/index.ts`

### Phase 4: Delegation (Corrected Implementation)
- `packages/platform-cli/src/delegation/forwarder.ts` (pure forwarding)
- `packages/platform-cli/src/delegation/dry-run.ts`
- `packages/platform-cli/src/delegation/provenance.ts`
- `packages/platform-cli/src/delegation/index.ts`

### Phase 5: Command Routing
- `packages/platform-cli/src/routing/`

### Phase 6: Org & Env Commands (Corrected: no promote in env)
- `packages/platform-cli/src/commands/org/`
- `packages/platform-cli/src/commands/env/` (list, switch, current only)

### Phase 7: Artifact & Intent Commands (Corrected)
- `packages/platform-cli/src/commands/artifact/` (plan, inspect, diff, list)
- `packages/platform-cli/src/commands/intent/` (includes promote)

### Phase 8: Architecture Commands (Corrected: read-only)
- `packages/platform-cli/src/commands/architecture/` (layers, boundaries, repos, validate)

### Phase 9: Entry Points
- `packages/platform-cli/src/index.ts`
- `packages/platform-cli/src/cli.ts`

### Phase 10: Documentation
- `packages/platform-cli/README.md`

---

## Validation Checklist

| Constraint | Source Document | Validated |
|------------|-----------------|-----------|
| CLI is Layer 5 consumer | DEPENDENCY_GRAPH.md §Layer 5 | ✓ |
| No Layer 3 core imports | FORBIDDEN_PATHS.md §1 | ✓ |
| No Layer 2 service imports | FORBIDDEN_PATHS.md §1 | ✓ |
| No direct simulation execution | FORBIDDEN_PATHS.md §1 (API Restriction) | ✓ |
| Routes through Layer 4 API | DEPENDENCY_GRAPH.md §Layer 5 | ✓ |
| May import @agentics/shared | FORBIDDEN_PATHS.md §1 (Allowed) | ✓ |
| Policy reads from docs | This correction | ✓ |
| Delegation is pure forwarding | This correction | ✓ |
| Architecture commands read-only | This correction | ✓ |
| Promotion in intent lifecycle | This correction | ✓ |

---

## Success Criteria (Unchanged)

- Binary executable: `agentics-platform`
- All commands resolve org/env context before execution
- Policy violations produce explicit, actionable errors
- Dry-run shows detailed execution plan without side effects
- Provenance stamps on all generated artifacts
- No forbidden dependencies in package.json
- Passes architecture enforcement CI checks
- Documentation suitable for CTO/PE audit review
