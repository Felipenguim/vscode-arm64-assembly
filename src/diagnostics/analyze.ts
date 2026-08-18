/**
 * Runs every rule over a parsed document and applies inline suppressions.
 *
 * Pure: takes the document as `string[]`, returns `Finding[]`. No `vscode`.
 */

import { isKnownMnemonic } from '../data/mnemonics';
import { parseLines } from '../parser/lineParser';
import type { ParsedLine } from '../parser/types';
import { checkSyntax } from './rules/syntax';
import { checkSymbols, checkUnknownMnemonic } from './rules/symbols';
import type { SymbolIndex } from './symbolIndex';
import type { Finding, FindingCategory } from './findings';

/**
 * Extra knowledge the symbol rules need. Optional: without it the symbol
 * family simply does not run, which is what keeps `analyze()` usable from a
 * unit test with nothing but a string.
 */
export interface AnalysisContext {
  symbols?: SymbolIndex;
}

const IGNORE_LINE_RE = /\barm64asm-ignore-line\b/i;
const IGNORE_CAT_RE  = /\barm64asm-ignore:\s*([A-Za-z, ]+)/i;

export function analyze(lines: string[], context: AnalysisContext = {}): Finding[] {
  const parsed = parseLines(lines);
  const findings: Finding[] = [];

  for (const line of parsed) {
    findings.push(...runRules(line, context));
  }

  return findings.filter(f => !isSuppressed(f, lines[f.line] ?? ''));
}

/** Exposed so tests can run the rule set against an already-parsed line. */
export function runRules(line: ParsedLine, context: AnalysisContext): Finding[] {
  const out: Finding[] = [...checkSyntax(line)];

  if (context.symbols) {
    out.push(...checkSymbols(line, context.symbols));

    // A mnemonic we do not recognise is only worth reporting once we can rule
    // out that it is a macro — which needs the index.
    if (line.mnemonic && !line.isDirective && !isKnownMnemonic(line.mnemonic.text)
        && !line.mnemonic.raw.includes(String.fromCharCode(92))) {
      out.push(...checkUnknownMnemonic(line, context.symbols));
    }
  }

  return out;
}

// ── Inline suppression ────────────────────────────────────────────────────────

function isSuppressed(f: Finding, lineText: string): boolean {
  if (IGNORE_LINE_RE.test(lineText)) { return true; }

  const m = IGNORE_CAT_RE.exec(lineText);
  if (!m) { return false; }

  const categories = m[1]
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(s => s.length > 0);

  return categories.includes(f.category.toLowerCase());
}

export type { Finding, FindingCategory };
