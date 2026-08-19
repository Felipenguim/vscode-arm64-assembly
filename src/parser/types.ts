/**
 * Shared types for the ARM64 line parser.
 *
 * Kept free of any `vscode` import so the whole analysis core can be unit
 * tested without an extension host, and later reused by a standalone LSP
 * server (Level 6 of the roadmap).
 */

/** Half-open column range within a single line, zero-based. */
export interface Span {
  start: number;
  end: number;
}

/**
 * A whitespace-delimited chunk of an operand.
 *
 * `add x0, x1, x2, lsl #3` yields the operand `lsl #3`, which is two tokens.
 * Balanced groups (`[x1, #8]!`, `{v0.16b, v1.16b}`) and quoted strings are a
 * single token even though they contain spaces and commas.
 */
export interface Token {
  text: string;
  span: Span;
}

export type OperandKind =
  // General-purpose registers
  | 'xreg' | 'wreg' | 'sp' | 'wsp' | 'xzr' | 'wzr'
  // Vector / FP
  | 'vreg'        // v0.16b — with an arrangement
  | 'vlane'       // v3.s[0] — with a lane index
  | 'vplain'      // v0 — no arrangement (valid for a few forms)
  | 'qreg' | 'dreg' | 'sreg' | 'hreg' | 'breg'
  | 'reglist'     // { v0.16b, v1.16b } used by ld1..ld4 / st1..st4
  // Values
  | 'imm'         // #42, #0x1F, #-1, #1.5
  | 'bareNumber'  // 42 — GAS accepts it, but `#` is the canonical form
  | 'mem'         // [x1, #8] and friends
  | 'ldrLiteral'  // =symbol / =0x1234
  | 'symbol'      // a bare identifier: branch target, .equ name, macro arg
  | 'shift'       // lsl #3
  | 'extend'      // uxtw #2
  | 'cond'        // eq, ne, hs, …
  | 'sysreg'      // nzcv, tpidr_el0, …
  | 'string'      // "text"
  | 'wildcard'    // \param inside a macro body, or an expression we cannot evaluate
  | 'unknown';

/** Sub-form of a `mem` operand. */
export type MemForm =
  | 'base'        // [x1]
  | 'baseImm'     // [x1, #8]
  | 'baseReg'     // [x1, x2] / [x1, w2, uxtw #2]
  | 'preIndex'    // [x1, #8]!
  | 'postIndex'   // [x1], #8
  | 'malformed';

export interface Operand {
  /** Operand source text with surrounding whitespace removed. */
  text: string;
  span: Span;
  tokens: Token[];
  kind: OperandKind;
  /** Register width in bits, when the operand is a register. */
  width?: number;
  /** For `vreg` / `vlane`: the arrangement (`16b`) or element letter (`s`). */
  arrangement?: string;
  /** For `vlane`: the lane index. */
  laneIndex?: number;
  /** For `mem`: which addressing form was written. */
  memForm?: MemForm;
  /** For `imm` / `bareNumber`: the parsed value, when it is an integer literal. */
  value?: bigint;
  /** True when the literal carries a fractional part (`#1.5`, `1.56`). */
  isFloat?: boolean;
}

export interface ParsedLine {
  /** Zero-based line number in the document. */
  lineNumber: number;
  /** The raw, unmodified line text. */
  raw: string;
  /** Label written at the start of the line, e.g. `loop:` or `.Lfail:`. */
  label?: { name: string; span: Span };
  /** Mnemonic or directive. `text` is lowercased; `.quad` keeps its dot. */
  mnemonic?: { text: string; raw: string; span: Span };
  isDirective: boolean;
  /** A `#include` / `#define` line handled by cpp in `.S` files — never linted. */
  isPreprocessor: boolean;
  /** A GAS symbol assignment, `len = . - msg`. The "mnemonic" is the symbol name. */
  isAssignment: boolean;
  operands: Operand[];
  /** Gaps where two operands sat side by side with no comma between them. */
  missingCommas: Span[];
  /** A comma directly after the mnemonic: `add, sp, sp, #16`. */
  strayCommaAfterMnemonic?: Span;
  /** Comma-separated slots that held no text: `add x0,, x1` or a trailing comma. */
  emptyOperands: Span[];
  /** Unbalanced `[`, `{`, `(` or an unterminated string. */
  unbalanced?: { char: string; span: Span };
  /** True while inside a `.macro` … `.endm` block, where `\param` may appear. */
  inMacroBody: boolean;
  comment?: Span;
}
