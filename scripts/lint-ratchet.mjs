#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const baselinePath = resolve(root, 'config/lint-baseline.json');

function collectFindings() {
  const eslint = resolve(root, 'node_modules/.bin/eslint');
  const result = spawnSync(
    eslint,
    ['.', '--ext', '.ts,.tsx,.mts', '--format', 'json'],
    { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
  );

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0 && result.status !== 1) {
    process.stderr.write(result.stderr);
    throw new Error(`ESLint exited with status ${result.status}`);
  }

  const reports = JSON.parse(result.stdout);
  const counts = new Map();
  for (const report of reports) {
    const file = relative(root, report.filePath).replaceAll('\\', '/');
    for (const finding of report.messages) {
      const key = JSON.stringify([
        file,
        finding.ruleId ?? 'parser-error',
        finding.message,
      ]);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}

function serialize(counts) {
  return [...counts.entries()]
    .map(([key, count]) => {
      const [file, ruleId, message] = JSON.parse(key);
      return { file, ruleId, message, count };
    })
    .sort((a, b) =>
      a.file.localeCompare(b.file) ||
      a.ruleId.localeCompare(b.ruleId) ||
      a.message.localeCompare(b.message),
    );
}

function toMap(findings) {
  return new Map(
    findings.map(({ file, ruleId, message, count }) => [
      JSON.stringify([file, ruleId, message]),
      count,
    ]),
  );
}

const current = collectFindings();
if (process.argv.includes('--write-baseline')) {
  const payload = {
    schemaVersion: 1,
    description:
      'Pre-existing ESLint findings. The lint ratchet rejects new instances and accepts removals.',
    findings: serialize(current),
  };
  writeFileSync(baselinePath, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(
    `Wrote ${current.size} lint fingerprints to ${relative(root, baselinePath)}`,
  );
  process.exit(0);
}

const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
if (baseline.schemaVersion !== 1 || !Array.isArray(baseline.findings)) {
  throw new Error('Unsupported lint baseline schema');
}

const allowed = toMap(baseline.findings);
const regressions = new Map();
let currentTotal = 0;
let baselineTotal = 0;
for (const count of current.values()) currentTotal += count;
for (const count of allowed.values()) baselineTotal += count;

for (const [key, count] of current) {
  const excess = count - (allowed.get(key) ?? 0);
  if (excess > 0) {
    regressions.set(key, excess);
  }
}

if (regressions.size > 0) {
  console.error('Lint ratchet failed: new findings detected.');
  for (const finding of serialize(regressions)) {
    console.error(
      `- ${finding.file} ${finding.ruleId}: ${finding.message} (+${finding.count})`,
    );
  }
  process.exit(1);
}

console.log(
  `Lint ratchet passed: ${currentTotal} known findings, 0 new, ${baselineTotal - currentTotal} resolved.`,
);
