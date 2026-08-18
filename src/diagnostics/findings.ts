/**
 * The vscode-free result type of the analysis core.
 *
 * `manager.ts` is the only place that turns a `Finding` into a
 * `vscode.Diagnostic`, which is what lets the rules be unit tested without an
 * extension host and reused by a standalone LSP server later.
 */

import type { Span } from '../parser/types';

/**
 * Rule family. Each one maps to an `arm64asm.diagnostics.<category>` setting
 * whose value chooses the severity — or turns the family off entirely.
 */
export type FindingCategory =
  /** Missing comma, stray comma, unbalanced bracket — genuinely will not assemble. */
  | 'syntax'
  /** Operand shapes checked against the instruction signature table. */
  | 'operands'
  /** A directive that does not exist in GAS, or a value of the wrong type. */
  | 'directives'
  /** A directive absent from our list, which may just mean our list is short. */
  | 'unknownDirective'
  /** Branch or reference to a label/symbol nothing defines. */
  | 'symbols'
  /** A constant written without the canonical `#`. GAS accepts it. */
  | 'immediateHash'
  /** Vector lane out of range, mismatched arrangements. */
  | 'vectors';

/** A single edit that fixes the finding, offered as a VS Code quick-fix. */
export interface FindingFix {
  title: string;
  /** Span to replace. Defaults to the finding's own span. */
  span?: Span;
  newText: string;
}

export interface Finding {
  /** Zero-based line number. */
  line: number;
  span: Span;
  /** Stable identifier, e.g. `arm64/missing-comma`. Shown in the Problems panel. */
  code: string;
  category: FindingCategory;
  message: string;
  fix?: FindingFix;
}

export function finding(
  line: number,
  span: Span,
  code: string,
  category: FindingCategory,
  message: string,
  fix?: FindingFix
): Finding {
  return { line, span, code, category, message, fix };
}
