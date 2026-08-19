/**
 * Compiles operand-form strings into matchers.
 *
 * The point of this file is that `instructionSignatures.ts` can be written in
 * (almost) the notation the hover docs already use — `LDP Rt1, Rt2, mem` — and
 * still be machine-checkable. Writing a matcher per instruction by hand would
 * not survive a few hundred entries.
 *
 * ## Spec vocabulary
 *
 * A form is a comma-separated list of specs. A trailing `?` makes a spec
 * optional, which covers post-index (`Rt, mem, #imm?`) and shift suffixes.
 *
 * | Spec | Matches |
 * |---|---|
 * | `Rd Rn Rm Rt Rt2 Ra Rs` | a GPR — the width is **shared across the form**, so `add x0, w1, x2` fails |
 * | `Rd\|SP`               | the above, or `sp`/`wsp` of the bound width |
 * | `rd rn rm rt`          | a GPR of any width, **not** bound — the extended-register form, where the extend operator sets the width |
 * | `Xd Xn Xm Xt Xt2 Xa`   | a 64-bit GPR specifically |
 * | `Wd Wn Wm Wt Wt2 Wa`   | a 32-bit GPR specifically |
 * | `Vd.T Vn.T Vm.T Va.T`  | a vector — the arrangement is **shared across the form** |
 * | `Vd.2d`                | a vector with exactly that arrangement |
 * | `Vd.* Vn.*`            | a vector of any arrangement, not shared (widening/narrowing ops) |
 * | `Vd[] Vn[]`            | a vector lane, `v3.s[0]` |
 * | `Fd Fn Fm Fa`          | an FP scalar — the size is **shared across the form** |
 * | `fd fn fm`             | an FP scalar of any size, not shared (`fcvt` converts between sizes) |
 * | `Sd Dn Hm Bd Qn`       | an FP scalar of exactly that size |
 * | `#imm`                 | an immediate (with or without `#` — GAS accepts both) |
 * | `#fpimm`               | an immediate that may carry a fractional part |
 * | `mem`                  | any `[...]` addressing form |
 * | `=sym`                 | the `LDR Rt, =symbol` pseudo-instruction |
 * | `label`                | a branch target |
 * | `cond`                 | a condition code |
 * | `sysreg` / `pstate`    | a system register / a PSTATE field |
 * | `list`                 | a `{v0.16b, v1.16b}` register list |
 * | `shift` / `extend` / `shiftex` | a shift suffix, an extend suffix, or either |
 * | `expr`                 | anything value-like: immediate, symbol, or expression |
 *
 * Operands classified as `unknown` (an expression we did not try to evaluate)
 * or `wildcard` (a macro parameter) match everything, on purpose.
 */

import { ARRANGEMENTS } from '../data/vectorArrangements';
import type { Operand } from './types';

/** Why a form did not match. Drives both the message and the rule category. */
export type MatchFailure =
  /** Too few or too many operands. */
  | 'arity'
  /** An operand is the wrong sort of thing entirely. */
  | 'kind'
  /** X and W registers mixed within one instruction. */
  | 'width'
  /** Vector arrangements that must agree do not. */
  | 'arrangement'
  /** FP scalar sizes that must agree do not. */
  | 'fpsize';

export interface Form {
  /** The source string, shown to the user as an accepted form. */
  raw: string;
  specs: Spec[];
}

export interface Spec {
  text: string;
  optional: boolean;
}

export interface MatchResult {
  ok: boolean;
  failure?: MatchFailure;
  /** Index of the operand that failed, when there is one. */
  operandIndex?: number;
}

/** Bindings that must stay consistent within a single form. */
interface Env {
  gprWidth?: number;
  fpWidth?: number;
  arrangement?: string;
}

// ── Compilation ───────────────────────────────────────────────────────────────

/** Turns `'Rt, mem, #imm?'` into a `Form`. */
export function compileForm(raw: string): Form {
  const body = raw.replace(/\/\/.*$/, '').trim();
  const specs = body.length === 0
    ? []
    : body.split(',').map(part => {
        const text = part.trim();
        return text.endsWith('?')
          ? { text: text.slice(0, -1).trim(), optional: true }
          : { text, optional: false };
      });

  return { raw: body, specs };
}

// ── Matching ──────────────────────────────────────────────────────────────────

/**
 * Matches `operands` against `form`.
 *
 * Optional specs may be skipped anywhere in the list, so the search is a small
 * recursion rather than a straight zip.
 */
export function matchForm(form: Form, operands: readonly Operand[]): MatchResult {
  return walk(form.specs, 0, operands, 0, {});
}

function walk(
  specs: readonly Spec[],
  i: number,
  ops: readonly Operand[],
  j: number,
  env: Env
): MatchResult {
  if (i === specs.length) {
    return j === ops.length ? { ok: true } : { ok: false, failure: 'arity', operandIndex: j };
  }

  if (j === ops.length) {
    return specs.slice(i).every(s => s.optional)
      ? { ok: true }
      : { ok: false, failure: 'arity' };
  }

  const spec = specs[i];

  // Try consuming this operand with this spec.
  const next: Env = { ...env };
  const failure = matchSpec(spec.text, ops[j], next);
  if (failure === undefined) {
    const rest = walk(specs, i + 1, ops, j + 1, next);
    if (rest.ok) { return rest; }
    // Keep the deeper failure — it points at the operand that really disagrees.
    if (!spec.optional) { return rest; }
  }

  // Or skip it, when it is optional.
  if (spec.optional) {
    const skipped = walk(specs, i + 1, ops, j, env);
    if (skipped.ok) { return skipped; }
  }

  return { ok: false, failure: failure ?? 'kind', operandIndex: j };
}

// ── Individual specs ──────────────────────────────────────────────────────────

const GPR_SPEC   = /^([RXWr])(?:d|n|m|t1|t2|t|a|s)(\|SP)?$/;
const VEC_BOUND  = /^V(?:d|n|m|t1|t2|t|a)\.T$/;
const VEC_ANY    = /^V(?:d|n|m|t1|t2|t|a)\.\*$/;
const VEC_EXACT  = /^V(?:d|n|m|t1|t2|t|a)\.([0-9]+[bhsdq])$/;
const VEC_LANE   = /^V(?:d|n|m|t1|t2|t|a)\[\]$/;
const FP_BOUND   = /^F(?:d|n|m|t1|t2|t|a)$/;
const FP_ANY     = /^f(?:d|n|m|t1|t2|t|a)$/;
const FP_EXACT   = /^([SDHBQ])(?:d|n|m|t1|t2|t|a)$/;

const GPR_KINDS  = new Set(['xreg', 'wreg', 'xzr', 'wzr']);
const FP_KIND_WIDTH: Record<string, number> = { breg: 8, hreg: 16, sreg: 32, dreg: 64, qreg: 128 };
const EXACT_FP_KIND: Record<string, string> = {
  S: 'sreg', D: 'dreg', H: 'hreg', B: 'breg', Q: 'qreg',
};

/**
 * Returns `undefined` on a match, or the reason it failed.
 * Mutates `env` to record any binding the match established.
 */
function matchSpec(spec: string, op: Operand, env: Env): MatchFailure | undefined {
  // An expression we did not evaluate, or a macro parameter, could be anything.
  if (op.kind === 'unknown' || op.kind === 'wildcard') { return undefined; }

  const gpr = GPR_SPEC.exec(spec);
  if (gpr) { return matchGpr(gpr[1], gpr[2] !== undefined, op, env); }

  if (VEC_BOUND.test(spec)) {
    if (op.kind !== 'vreg') { return 'kind'; }
    if (env.arrangement === undefined) { env.arrangement = op.arrangement; return undefined; }
    return env.arrangement === op.arrangement ? undefined : 'arrangement';
  }

  if (VEC_ANY.test(spec)) { return op.kind === 'vreg' ? undefined : 'kind'; }

  const exactVec = VEC_EXACT.exec(spec);
  if (exactVec) {
    if (op.kind !== 'vreg') { return 'kind'; }
    return op.arrangement === exactVec[1].toLowerCase() ? undefined : 'arrangement';
  }

  if (VEC_LANE.test(spec)) { return op.kind === 'vlane' ? undefined : 'kind'; }

  if (FP_BOUND.test(spec)) {
    const width = FP_KIND_WIDTH[op.kind];
    if (width === undefined) { return 'kind'; }
    if (env.fpWidth === undefined) { env.fpWidth = width; return undefined; }
    return env.fpWidth === width ? undefined : 'fpsize';
  }

  if (FP_ANY.test(spec)) { return FP_KIND_WIDTH[op.kind] === undefined ? 'kind' : undefined; }

  const exactFp = FP_EXACT.exec(spec);
  if (exactFp) { return op.kind === EXACT_FP_KIND[exactFp[1]] ? undefined : 'kind'; }

  switch (spec) {
    // A bare name in an immediate slot is an assemble-time constant —
    // `.equ SYS_READ, 63` then `mov w8, SYS_READ` is ordinary, correct code.
    case '#imm':
      return (op.kind === 'imm' || op.kind === 'bareNumber' || op.kind === 'symbol')
        && !op.isFloat ? undefined : 'kind';
    case '#fpimm':
      return op.kind === 'imm' || op.kind === 'bareNumber' || op.kind === 'symbol'
        ? undefined : 'kind';
    case 'mem':
      return op.kind === 'mem' ? undefined : 'kind';
    case '=sym':
      return op.kind === 'ldrLiteral' ? undefined : 'kind';
    case 'label':
      return op.kind === 'symbol' ? undefined : 'kind';
    case 'cond':
      return op.kind === 'cond' ? undefined : 'kind';
    case 'sysreg':
      return op.kind === 'sysreg' || op.kind === 'symbol' ? undefined : 'kind';
    case 'pstate':
      return op.kind === 'sysreg' || op.kind === 'symbol' ? undefined : 'kind';
    case 'list':
      return op.kind === 'reglist' ? undefined : 'kind';
    case 'shift':
      return op.kind === 'shift' ? undefined : 'kind';
    case 'extend':
      return op.kind === 'extend' ? undefined : 'kind';
    case 'shiftex':
      return op.kind === 'shift' || op.kind === 'extend' ? undefined : 'kind';
    case 'expr':
      return op.kind === 'imm' || op.kind === 'bareNumber'
          || op.kind === 'symbol' || op.kind === 'cond' ? undefined : 'kind';
    default:
      // An unrecognised spec must never reject anything.
      return undefined;
  }
}

function matchGpr(
  letter: string,
  allowsSp: boolean,
  op: Operand,
  env: Env
): MatchFailure | undefined {
  const isSp = op.kind === 'sp' || op.kind === 'wsp';
  if (isSp && !allowsSp) { return 'kind'; }
  if (!isSp && !GPR_KINDS.has(op.kind)) { return 'kind'; }

  const width = op.width;
  if (width === undefined) { return undefined; }

  if (letter === 'X') { return width === 64 ? undefined : 'width'; }
  if (letter === 'W') { return width === 32 ? undefined : 'width'; }

  // `r` — any GPR, deliberately not bound. Used by the extended-register form,
  // where the extend operator sets the width: `add x0, x1, w2, uxtw #2` is
  // correct, and binding `w2` against `x0` would reject working code.
  if (letter === 'r') { return undefined; }

  // `R` — the first GPR in the form fixes the width for the rest of it.
  if (env.gprWidth === undefined) { env.gprWidth = width; return undefined; }
  return env.gprWidth === width ? undefined : 'width';
}

// ── Lane ranges ───────────────────────────────────────────────────────────────

/**
 * The highest valid lane index for an element letter, or `undefined` when the
 * letter is not one we know.
 *
 * `v10.s[9]` is rejected by the assembler with
 * "register element index out of range 0 to 3".
 */
export function maxLaneIndex(elementLetter: string): number | undefined {
  const letter = elementLetter.toLowerCase();
  for (const arrangement of ARRANGEMENTS.values()) {
    if (arrangement.elemLetter === letter) { return 128 / arrangement.elemBits - 1; }
  }
  return undefined;
}
