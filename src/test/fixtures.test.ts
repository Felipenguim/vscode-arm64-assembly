/**
 * Runs the analyser over the two fixture files in `examples/`.
 *
 * `lint_errors.s` tags each bad line with `// expects: <code>`; this checks the
 * analyser reports exactly those codes and nothing extra.
 *
 * `lint_clean.s` must produce nothing at all. It assembles cleanly under
 * `aarch64-linux-gnu-as`, so any finding there is a false positive.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { analyze } from '../diagnostics/analyze';
import { buildSymbolIndex } from '../diagnostics/symbolIndex';

const EXAMPLES = path.resolve(__dirname, '..', '..', 'examples');
const EXPECT_RE = /\/\/\s*expects:\s*(arm64\/\S+)/;

function read(name: string): string[] {
  return fs.readFileSync(path.join(EXAMPLES, name), 'utf8').split(/\r?\n/);
}

function run(lines: string[]) {
  return analyze(lines, { symbols: buildSymbolIndex([lines]) });
}

test('lint_errors.s reports exactly what each line advertises', () => {
  const lines = read('lint_errors.s');
  const found = run(lines);

  const byLine = new Map<number, string[]>();
  for (const f of found) {
    byLine.set(f.line, [...(byLine.get(f.line) ?? []), f.code]);
  }

  const missing: string[] = [];
  const annotated = new Set<number>();

  for (let i = 0; i < lines.length; i++) {
    const m = EXPECT_RE.exec(lines[i]);
    if (!m) { continue; }
    annotated.add(i);
    const codes = byLine.get(i) ?? [];
    if (!codes.includes(m[1])) {
      missing.push(`line ${i + 1}: expected ${m[1]}, got [${codes.join(', ')}]`);
    }
  }

  assert.equal(missing.length, 0, '\n' + missing.join('\n'));

  const unexpected = found
    .filter(f => !annotated.has(f.line))
    .map(f => `line ${f.line + 1}: ${f.code} — ${lines[f.line].trim()}`);

  assert.equal(unexpected.length, 0, '\nfindings on lines with no annotation:\n' + unexpected.join('\n'));
});

test('lint_clean.s produces no findings at all', () => {
  const found = run(read('lint_clean.s'));
  const report = found.map(f => `line ${f.line + 1}: [${f.code}] ${f.message}`);
  assert.equal(found.length, 0, '\nfalse positives:\n' + report.join('\n'));
});
