/**
 * Classifies a single operand's source text into an `OperandKind`.
 *
 * Reuses the arrangement table from `data/vectorArrangements.ts` (the one
 * already-structured dataset in the repo) and the register names from
 * `data/registers.ts`, rather than re-listing them.
 *
 * Deliberately free of any `vscode` import.
 */

import { ARRANGEMENTS } from '../data/vectorArrangements';
import { REGISTER_DOCS } from '../data/registers';
import { parseNumericLiteral } from './numbers';
import type { MemForm, Operand, OperandKind } from './types';

const BACKSLASH = String.fromCharCode(92);

const X_RE    = /^x(3[0]|[12][0-9]|[0-9])$/i;
const W_RE    = /^w(3[0]|[12][0-9]|[0-9])$/i;
const FP_RE   = /^([qdshb])(3[01]|[12][0-9]|[0-9])$/i;
const VPLAIN_RE = /^v(3[01]|[12][0-9]|[0-9])$/i;
const VARR_RE = /^v(3[01]|[12][0-9]|[0-9])\.([0-9]+[bhsdq])$/i;
const VLANE_RE = /^v(3[01]|[12][0-9]|[0-9])\.([bhsdq])\[([0-9]+)\]$/i;

const SHIFT_RE  = /^(lsl|lsr|asr|ror|msl)\b/i;
const EXTEND_RE = /^(uxtb|uxth|uxtw|uxtx|sxtb|sxth|sxtw|sxtx)\b/i;
const COND_RE   = /^(eq|ne|cs|hs|cc|lo|mi|pl|vs|vc|hi|ls|ge|lt|gt|le|al|nv)$/i;

/** PSTATE fields usable as the destination of `msr`. */
const PSTATE_FIELDS = new Set(['daifset', 'daifclr', 'spsel', 'pan', 'uao', 'dit', 'ssbs', 'tco']);

const IDENT_RE = /^\.?[A-Za-z_$][A-Za-z0-9_.$]*$/;

const FP_WIDTH: Record<string, number> = { b: 8, h: 16, s: 32, d: 64, q: 128 };
const FP_KIND: Record<string, OperandKind> = {
  b: 'breg', h: 'hreg', s: 'sreg', d: 'dreg', q: 'qreg',
};

/**
 * Returns the fields of `Operand` that describe what the text is.
 * Never throws: anything unrecognised comes back as `'unknown'`.
 */
export function classifyOperand(text: string, inMacroBody: boolean): Partial<Operand> {
  const t = text.trim();
  if (t.length === 0) { return { kind: 'unknown' }; }

  // A macro parameter substitutes arbitrary text, so nothing can be asserted
  // about it. Without this, every macro in examples/SYS/*.s is a false positive.
  if (inMacroBody && t.includes(BACKSLASH)) { return { kind: 'wildcard' }; }
  if (t.includes(BACKSLASH)) { return { kind: 'wildcard' }; }

  if (t.startsWith('"')) { return { kind: 'string' }; }
  if (t.startsWith('=')) { return { kind: 'ldrLiteral' }; }
  if (t.startsWith('{')) { return { kind: 'reglist' }; }
  if (t.startsWith('[')) { return { kind: 'mem', memForm: classifyMemForm(t) }; }

  if (SHIFT_RE.test(t))  { return { kind: 'shift' }; }
  if (EXTEND_RE.test(t)) { return { kind: 'extend' }; }

  const reg = classifyRegister(t);
  if (reg) { return reg; }

  const num = parseNumericLiteral(t);
  if (num) {
    return {
      kind: num.hasHash ? 'imm' : 'bareNumber',
      value: num.value,
      isFloat: num.isFloat,
    };
  }

  if (COND_RE.test(t)) { return { kind: 'cond' }; }

  const lower = t.toLowerCase();
  if (PSTATE_FIELDS.has(lower)) { return { kind: 'sysreg' }; }
  if (REGISTER_DOCS.has(lower) && !X_RE.test(t) && !W_RE.test(t)) { return { kind: 'sysreg' }; }

  if (IDENT_RE.test(t)) { return { kind: 'symbol' }; }

  // Expressions such as `msg_end - msg`, `(1 << 3)` or `#SYS_write` after
  // macro expansion: known to be a value, not worth asserting more.
  return { kind: 'unknown' };
}

// ── Registers ─────────────────────────────────────────────────────────────────

function classifyRegister(t: string): Partial<Operand> | undefined {
  const lower = t.toLowerCase();

  if (lower === 'sp')  { return { kind: 'sp',  width: 64 }; }
  if (lower === 'wsp') { return { kind: 'wsp', width: 32 }; }
  if (lower === 'xzr') { return { kind: 'xzr', width: 64 }; }
  if (lower === 'wzr') { return { kind: 'wzr', width: 32 }; }
  if (lower === 'lr' || lower === 'fp') { return { kind: 'xreg', width: 64 }; }

  if (X_RE.test(t)) { return { kind: 'xreg', width: 64 }; }
  if (W_RE.test(t)) { return { kind: 'wreg', width: 32 }; }

  const lane = VLANE_RE.exec(t);
  if (lane) {
    return {
      kind: 'vlane',
      arrangement: lane[2].toLowerCase(),
      laneIndex: parseInt(lane[3], 10),
      width: 128,
    };
  }

  const arr = VARR_RE.exec(t);
  if (arr) {
    const spec = arr[2].toLowerCase();
    const known = ARRANGEMENTS.get(spec);
    return {
      kind: 'vreg',
      arrangement: spec,
      width: known ? known.totalBits : undefined,
    };
  }

  if (VPLAIN_RE.test(t)) { return { kind: 'vplain', width: 128 }; }

  const fp = FP_RE.exec(t);
  if (fp) {
    const letter = fp[1].toLowerCase();
    return { kind: FP_KIND[letter], width: FP_WIDTH[letter] };
  }

  return undefined;
}

// ── Memory operands ───────────────────────────────────────────────────────────

/**
 * Determines which addressing form a `[...]` operand uses.
 *
 * Note that post-index (`[x1], #8`) is *two* comma-separated operands, so it is
 * recognised by the form matcher, not here — here `[x1]` looks like plain base.
 */
function classifyMemForm(text: string): MemForm {
  const close = matchingBracket(text);
  if (close === -1) { return 'malformed'; }

  const inner = text.slice(1, close).trim();
  const after = text.slice(close + 1).trim();
  const parts = splitTopLevel(inner);

  if (parts.length === 0) { return 'malformed'; }

  let form: MemForm;
  if (parts.length === 1) {
    form = 'base';
  } else {
    const second = parts[1].trim();
    form = classifyRegister(second) ? 'baseReg' : 'baseImm';
  }

  if (after === '!') { return 'preIndex'; }
  if (after.length > 0) { return 'malformed'; }
  return form;
}

function matchingBracket(text: string): number {
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '[' || ch === '{' || ch === '(') { depth++; }
    else if (ch === ']' || ch === '}' || ch === ')') {
      depth--;
      if (depth === 0) { return i; }
    }
  }
  return -1;
}

/** Splits on commas that sit at bracket depth zero. */
export function splitTopLevel(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '[' || ch === '{' || ch === '(') { depth++; }
    else if (ch === ']' || ch === '}' || ch === ')') { depth--; }
    else if (ch === ',' && depth === 0) {
      out.push(text.slice(start, i));
      start = i + 1;
    }
  }

  out.push(text.slice(start));
  return out.map(s => s.trim()).filter((s, i, a) => !(s === '' && a.length === 1));
}
