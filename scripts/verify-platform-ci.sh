#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
node --test ci/stack/*.test.mts
bash ci/check-architecture.sh
npm ci --ignore-scripts --no-audit --no-fund
npm rebuild bcrypt
for workspace in shared contracts ruvector-client agents api; do
  npm run build --workspace="@agentics/$workspace"
done
node_modules/.bin/tsc --noEmit --strict --target ES2022 --module NodeNext --moduleResolution NodeNext --allowImportingTsExtensions --skipLibCheck ci/stack/*.mts
# The production entry point must resolve the same package exports as tests.
node --input-type=module -e 'await import("@agentics/agents"); await import("./packages/api/dist/server.js"); process.exit(0)'
status=0
npm run test --workspace=@agentics/api -- --run --pool=forks --poolOptions.forks.singleFork || status=1
npm run test --workspace=@agentics/agents -- --run --pool=forks --poolOptions.forks.singleFork || status=1
node --test packages/contracts/test/*.test.mjs || status=1
npm audit --audit-level=low || status=1
exit "$status"
