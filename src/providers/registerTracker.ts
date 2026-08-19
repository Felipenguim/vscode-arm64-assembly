import * as vscode from 'vscode';

// ── Types ─────────────────────────────────────────────────────────────────────

export type RegValue =
  | { kind: 'literal'; value: bigint }
  | { kind: 'address'; label: string }
  | { kind: 'unknown'; reason: string };

export type RegState = Map<string, RegValue>;

// ── Constants ─────────────────────────────────────────────────────────────────

/** AAPCS64 caller-saved registers clobbered by bl/blr. */
const CALLER_SAVED: string[] = [
  ...[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17].flatMap(n => [`x${n}`, `w${n}`]),
];

/** Mnemonics that write to memory or flags only — never to a GPR destination. */
const NON_WRITING = new Set([
  'str','strb','strh','stlr','stlrb','stlrh','stxr','stxrb','stxrh',
  'stp','stxp','stlxp',
  'b','bl','blr','br','ret',
  'cmp','cmn','tst','fcmp',
  'cbz','cbnz','tbz','tbnz',
  'msr','svc','hvc','smc','hlt','brk',
  'wfi','wfe','sev','nop','isb','dsb','dmb','eret',
]);

// ── Regex ─────────────────────────────────────────────────────────────────────

const FUNC_LABEL_RE  = /^\s*([a-zA-Z][a-zA-Z0-9_]*)\s*:/;
const LABEL_STRIP_RE = /^[a-zA-Z_][a-zA-Z0-9_.]*\s*:\s*|^[0-9]+\s*:\s*/;
const STRIP_COMMENT  = /\s*(?:\/\/|@|\/\*).*$/;

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Performs forward constant-propagation from the nearest function label above
 * `targetLine` up to (but not including) `targetLine`.
 *
 * Returns the inferred register state and the name of the enclosing function.
 */
export function trackRegistersToLine(
  document: vscode.TextDocument,
  targetLine: number
): { state: RegState; functionName: string | undefined } {
  let startLine = 0;
  let functionName: string | undefined;

  for (let i = targetLine - 1; i >= 0; i--) {
    const m = FUNC_LABEL_RE.exec(document.lineAt(i).text);
    if (m) {
      startLine = i;
      functionName = m[1];
      break;
    }
  }

  const state: RegState = new Map();

  for (let i = startLine; i < targetLine; i++) {
    const raw  = document.lineAt(i).text;
    const line = raw.replace(STRIP_COMMENT, '').trimEnd();
    applyInstruction(state, line);
  }

  return { state, functionName };
}

// ── Instruction interpreter ───────────────────────────────────────────────────

function applyInstruction(state: RegState, line: string): void {
  let trimmed = line.trim();

  // Strip label prefix (e.g. "my_label:  mov x0, #1")
  trimmed = trimmed.replace(LABEL_STRIP_RE, '').trim();

  // Skip empty lines, directives, and macro definitions
  if (!trimmed || trimmed.startsWith('.')) { return; }

  const spaceIdx = trimmed.search(/\s/);
  if (spaceIdx === -1) { return; }

  const mnemonic = trimmed.slice(0, spaceIdx).toLowerCase();
  const rest     = trimmed.slice(spaceIdx).trim();

  // ── bl / blr: clobber AAPCS64 caller-saved regs ─────────────────────────────
  if (mnemonic === 'bl' || mnemonic === 'blr') {
    const target = rest.split(/[\s,]/)[0];
    for (const reg of CALLER_SAVED) {
      state.set(reg, { kind: 'unknown', reason: `clobbered by ${mnemonic} ${target}` });
    }
    return;
  }

  // ── ldr pseudo (ldr Xd, =expr) ──────────────────────────────────────────────
  if (mnemonic === 'ldr') {
    const pseudo = /^(\w+)\s*,\s*=(.+)$/.exec(rest);
    if (pseudo) {
      const dest  = pseudo[1].toLowerCase();
      const expr  = pseudo[2].trim();
      const imm   = parseImm(expr);
      if (imm !== undefined) {
        state.set(dest, { kind: 'literal', value: imm });
      } else {
        const lbl = /^([a-zA-Z_.][a-zA-Z0-9_.]*)/.exec(expr);
        state.set(dest, lbl
          ? { kind: 'address', label: lbl[1] }
          : { kind: 'unknown', reason: 'ldr =expr unresolved' });
      }
      return;
    }
    // Real memory load — fall through to catch-all
  }

  // ── adr / adrp ──────────────────────────────────────────────────────────────
  if (mnemonic === 'adr' || mnemonic === 'adrp') {
    const m = /^(\w+)\s*,\s*([a-zA-Z_.][a-zA-Z0-9_.]*)/.exec(rest);
    if (m) { state.set(m[1].toLowerCase(), { kind: 'address', label: m[2] }); }
    return;
  }

  // ── movz ────────────────────────────────────────────────────────────────────
  if (mnemonic === 'movz') {
    const m = /^(\w+)\s*,\s*(.+)$/.exec(rest);
    if (m) {
      const dest = m[1].toLowerCase();
      const imm  = parseImm(m[2]);
      const lsl  = parseLsl(m[2]);
      state.set(dest, imm !== undefined
        ? { kind: 'literal', value: imm << BigInt(lsl) }
        : { kind: 'unknown', reason: 'movz unresolved' });
    }
    return;
  }

  // ── movn ────────────────────────────────────────────────────────────────────
  if (mnemonic === 'movn') {
    const m = /^(\w+)\s*,\s*(.+)$/.exec(rest);
    if (m) {
      const dest  = m[1].toLowerCase();
      const imm   = parseImm(m[2]);
      const lsl   = parseLsl(m[2]);
      if (imm !== undefined) {
        const shifted = imm << BigInt(lsl);
        const mask    = dest.startsWith('w') ? 0xFFFFFFFFn : 0xFFFFFFFFFFFFFFFFn;
        state.set(dest, { kind: 'literal', value: (~shifted) & mask });
      } else {
        state.set(dest, { kind: 'unknown', reason: 'movn unresolved' });
      }
    }
    return;
  }

  // ── movk ────────────────────────────────────────────────────────────────────
  if (mnemonic === 'movk') {
    const m = /^(\w+)\s*,\s*(.+)$/.exec(rest);
    if (m) {
      const dest    = m[1].toLowerCase();
      const imm     = parseImm(m[2]);
      const lsl     = parseLsl(m[2]);
      const current = state.get(dest);
      if (imm !== undefined && current?.kind === 'literal') {
        const shift   = BigInt(lsl);
        const mask    = 0xFFFFn << shift;
        state.set(dest, { kind: 'literal', value: (current.value & ~mask) | ((imm & 0xFFFFn) << shift) });
      } else if (!state.has(dest)) {
        state.set(dest, { kind: 'unknown', reason: 'movk without prior movz' });
      }
    }
    return;
  }

  // ── mov ─────────────────────────────────────────────────────────────────────
  if (mnemonic === 'mov') {
    const m = /^(\w+)\s*,\s*(.+)$/.exec(rest);
    if (m) {
      const dest = m[1].toLowerCase();
      const src  = m[2].trim();
      if (isReg(src)) {
        state.set(dest, getRegValue(state, src));
      } else {
        const imm = parseImm(src);
        state.set(dest, imm !== undefined
          ? { kind: 'literal', value: imm }
          : { kind: 'unknown', reason: 'mov unresolved' });
      }
    }
    return;
  }

  // ── neg ─────────────────────────────────────────────────────────────────────
  if (mnemonic === 'neg') {
    const parts = splitOps(rest);
    if (parts.length >= 2) {
      const dest = parts[0].toLowerCase();
      const src  = getRegValue(state, parts[1]);
      state.set(dest, src.kind === 'literal'
        ? { kind: 'literal', value: -src.value }
        : { kind: 'unknown', reason: 'neg of unknown' });
    }
    return;
  }

  // ── mvn / orn xzr (bitwise NOT of immediate) ─────────────────────────────────
  if (mnemonic === 'mvn') {
    const parts = splitOps(rest);
    if (parts.length >= 2) {
      const dest = parts[0].toLowerCase();
      const imm  = parseImm(parts[1]);
      if (imm !== undefined) {
        const mask = dest.startsWith('w') ? 0xFFFFFFFFn : 0xFFFFFFFFFFFFFFFFn;
        state.set(dest, { kind: 'literal', value: (~imm) & mask });
      } else {
        const src = getRegValue(state, parts[1]);
        if (src.kind === 'literal') {
          const mask = dest.startsWith('w') ? 0xFFFFFFFFn : 0xFFFFFFFFFFFFFFFFn;
          state.set(dest, { kind: 'literal', value: (~src.value) & mask });
        } else {
          state.set(dest, { kind: 'unknown', reason: 'mvn of unknown' });
        }
      }
    }
    return;
  }

  // ── orr (handles "orr Xd, xzr, #imm" alias for mov Xd, #imm) ───────────────
  if (mnemonic === 'orr') {
    const parts = splitOps(rest);
    if (parts.length >= 3) {
      const dest = parts[0].toLowerCase();
      const lhs  = getRegValue(state, parts[1]);
      const imm  = parseImm(parts[2]);
      if (imm !== undefined && lhs.kind === 'literal') {
        state.set(dest, { kind: 'literal', value: lhs.value | imm });
      } else if (isReg(parts[2])) {
        const rhs = getRegValue(state, parts[2]);
        if (lhs.kind === 'literal' && rhs.kind === 'literal') {
          state.set(dest, { kind: 'literal', value: lhs.value | rhs.value });
        } else {
          state.set(dest, { kind: 'unknown', reason: 'orr operands not known' });
        }
      } else {
        state.set(dest, { kind: 'unknown', reason: 'orr unresolved' });
      }
    }
    return;
  }

  // ── add ─────────────────────────────────────────────────────────────────────
  if (mnemonic === 'add') {
    applyBinaryOp(state, rest, (a, b) => a + b, 'add');
    return;
  }

  // ── sub ─────────────────────────────────────────────────────────────────────
  if (mnemonic === 'sub') {
    applyBinaryOp(state, rest, (a, b) => a - b, 'sub');
    return;
  }

  // ── mul ─────────────────────────────────────────────────────────────────────
  if (mnemonic === 'mul') {
    applyBinaryOp(state, rest, (a, b) => a * b, 'mul');
    return;
  }

  // ── and ─────────────────────────────────────────────────────────────────────
  if (mnemonic === 'and') {
    applyBinaryOp(state, rest, (a, b) => a & b, 'and');
    return;
  }

  // ── eor ─────────────────────────────────────────────────────────────────────
  if (mnemonic === 'eor') {
    applyBinaryOp(state, rest, (a, b) => a ^ b, 'eor');
    return;
  }

  // ── lsl / lsr / asr / ror (shift with immediate) ────────────────────────────
  if (mnemonic === 'lsl' || mnemonic === 'lsr' || mnemonic === 'asr' || mnemonic === 'ror') {
    const parts = splitOps(rest);
    if (parts.length >= 3) {
      const dest   = parts[0].toLowerCase();
      const src    = getRegValue(state, parts[1]);
      const amount = parseImm(parts[2]);
      if (amount !== undefined && src.kind === 'literal') {
        let result: bigint;
        const mask = dest.startsWith('w') ? 0xFFFFFFFFn : 0xFFFFFFFFFFFFFFFFn;
        if (mnemonic === 'lsl') {
          result = (src.value << amount) & mask;
        } else if (mnemonic === 'lsr') {
          result = (src.value & mask) >> amount;
        } else if (mnemonic === 'asr') {
          result = src.value >> amount;
        } else {
          // ror
          const bits = dest.startsWith('w') ? 32n : 64n;
          const sh   = amount % bits;
          result = ((src.value >> sh) | (src.value << (bits - sh))) & mask;
        }
        state.set(dest, { kind: 'literal', value: result });
      } else {
        const dest2 = parts[0].toLowerCase();
        state.set(dest2, { kind: 'unknown', reason: `${mnemonic} operands not known` });
      }
    }
    return;
  }

  // ── ldp (two-register load from memory) ─────────────────────────────────────
  if (mnemonic === 'ldp') {
    const parts = splitOps(rest);
    if (parts.length >= 2) {
      if (isReg(parts[0])) { state.set(parts[0].toLowerCase(), { kind: 'unknown', reason: 'loaded from memory (ldp)' }); }
      if (isReg(parts[1])) { state.set(parts[1].toLowerCase(), { kind: 'unknown', reason: 'loaded from memory (ldp)' }); }
    }
    return;
  }

  // ── single-register memory loads ────────────────────────────────────────────
  if (/^ldr[bhsw]?$|^ldar[bh]?$|^ldxr[bh]?$|^ldaxr[bh]?$/.test(mnemonic)) {
    const dest = rest.split(',')[0].trim().toLowerCase();
    if (isReg(dest)) { state.set(dest, { kind: 'unknown', reason: 'loaded from memory' }); }
    return;
  }

  // ── Non-writing instructions: skip completely ────────────────────────────────
  if (NON_WRITING.has(mnemonic) || /^b(\.|$)/.test(mnemonic)) { return; }

  // ── Catch-all: if first operand is a register, mark as unknown ───────────────
  const firstOp = rest.split(',')[0].trim().toLowerCase();
  if (isReg(firstOp)) {
    state.set(firstOp, { kind: 'unknown', reason: `written by ${mnemonic}` });
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Split comma-separated operands, respecting that shift syntax has no commas. */
function splitOps(rest: string): string[] {
  return rest.split(',').map(s => s.trim());
}

/** Returns the tracked value of a register, treating xzr/wzr as literal 0. */
function getRegValue(state: RegState, reg: string): RegValue {
  const lower = reg.toLowerCase();
  if (lower === 'xzr' || lower === 'wzr') { return { kind: 'literal', value: 0n }; }
  return state.get(lower) ?? { kind: 'unknown', reason: `${reg} not yet assigned` };
}

/**
 * Applies a commutative binary operation (add/sub/mul/and/eor) to state.
 * Handles both `Rd, Rn, #imm` and `Rd, Rn, Rm` forms.
 */
function applyBinaryOp(
  state: RegState,
  rest: string,
  op: (a: bigint, b: bigint) => bigint,
  name: string
): void {
  const parts = splitOps(rest);
  if (parts.length < 3) { return; }
  const dest = parts[0].toLowerCase();
  const lhs  = getRegValue(state, parts[1]);
  const imm  = parseImm(parts[2]);

  if (imm !== undefined) {
    state.set(dest, lhs.kind === 'literal'
      ? { kind: 'literal', value: op(lhs.value, imm) }
      : { kind: 'unknown', reason: `${name}: ${parts[1]} not known` });
  } else if (isReg(parts[2])) {
    const rhs = getRegValue(state, parts[2]);
    state.set(dest, lhs.kind === 'literal' && rhs.kind === 'literal'
      ? { kind: 'literal', value: op(lhs.value, rhs.value) }
      : { kind: 'unknown', reason: `${name}: operands not fully known` });
  } else {
    state.set(dest, { kind: 'unknown', reason: `${name} unresolved` });
  }
}

/** Parse an ARM64 immediate: optional #, optional -, decimal/hex/binary. */
export function parseImm(s: string): bigint | undefined {
  const m = /^#?(-?)(?:(0[xX])([0-9a-fA-F]+)|(0[bB])([01]+)|([0-9]+))/.exec(s.trim());
  if (!m) { return undefined; }
  const neg = m[1] === '-';
  let val: bigint;
  if (m[2])      { val = BigInt('0x' + m[3]); }
  else if (m[4]) { val = BigInt('0b' + m[5]); }
  else           { val = BigInt(m[6]); }
  return neg ? -val : val;
}

/** Extract the lsl shift amount from an operand string, e.g. "#0xAB, lsl #8" → 8. */
function parseLsl(s: string): number {
  const m = /,\s*lsl\s+#(\d+)/i.exec(s);
  return m ? parseInt(m[1], 10) : 0;
}

/** Returns true if `s` is a valid AArch64 register name (GPR or special). */
function isReg(s: string): boolean {
  return /^[xwXW][0-9]{1,2}$/.test(s)
    || /^(?:sp|fp|lr|xzr|wzr|wsp|pc)$/i.test(s);
}
