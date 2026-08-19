/**
 * Line-level tokenizer for ARM64 / GNU AS source.
 *
 * This is the piece the diagnostics need and none of the existing providers
 * had: a single pass that preserves *column offsets*, so a finding can point
 * at the exact character that is wrong.
 *
 * It also consolidates three divergent implementations of "strip the comment"
 * that were spread across `registerTracker.ts`, `inlayHintProvider.ts` and the
 * two resolvers, and — unlike `splitOps()` in `registerTracker.ts` — it does
 * not split `[x1, x2]` down the middle.
 *
 * Deliberately free of any `vscode` import.
 */

import { classifyOperand } from './operandKind';
import type { Operand, ParsedLine, Span, Token } from './types';

const LABEL_RE  = /^[ \t]*(\.?[A-Za-z_$][A-Za-z0-9_.$]*|[0-9]+)[ \t]*:/;
/** Leading `%` is accepted so NASM's `%macro` reaches the directive rules. */
const MNEM_RE   = /^[ \t]*([%.]?[A-Za-z_][A-Za-z0-9_.]*)/;
const MACRO_RE  = /^[ \t]*\.macro\b/i;
const ENDM_RE   = /^[ \t]*\.endm\b/i;

/** `@` is a comment marker, except in `.type foo,@function`. */
const AT_TYPE_RE =
  /^@(function|object|notype|tls_object|gnu_indirect_function|common|progbits|nobits|note|init_array|fini_array|preinit_array)\b/i;

const CLOSER: Record<string, string> = { '[': ']', '{': '}', '(': ')' };

/** Second-operand keywords that legitimately follow another token without a comma. */
const SHIFT_OPS  = new Set(['lsl', 'lsr', 'asr', 'ror', 'msl']);
const EXTEND_OPS = new Set(['uxtb', 'uxth', 'uxtw', 'uxtx', 'sxtb', 'sxth', 'sxtw', 'sxtx']);

/** Parses every line of a document, carrying block-comment and macro state across lines. */
export function parseLines(lines: string[]): ParsedLine[] {
  const out: ParsedLine[] = [];
  let inBlockComment = false;
  let inMacroBody = false;

  for (let i = 0; i < lines.length; i++) {
    const scan = scanComment(lines[i], inBlockComment);
    const parsed = parseCodeRegion(lines[i], i, scan, inMacroBody);
    inBlockComment = scan.inBlockAfter;

    // Macro state flips *after* the `.macro` line itself, so the definition
    // line is linted normally while its body is treated as templated.
    if (!parsed.isPreprocessor) {
      if (MACRO_RE.test(stripLabel(lines[i].slice(scan.codeStart, scan.codeEnd)))) { inMacroBody = true; }
      else if (ENDM_RE.test(stripLabel(lines[i].slice(scan.codeStart, scan.codeEnd)))) { inMacroBody = false; }
    }

    out.push(parsed);
  }

  return out;
}

/** Convenience wrapper for a single, self-contained line. */
export function parseLine(text: string, lineNumber = 0, inMacroBody = false): ParsedLine {
  const scan = scanComment(text, false);
  return parseCodeRegion(text, lineNumber, scan, inMacroBody);
}

// ── Comment scanning ──────────────────────────────────────────────────────────

interface CommentScan {
  codeStart: number;
  codeEnd: number;
  commentSpan?: Span;
  inBlockAfter: boolean;
}

/**
 * Finds the code region of a line, honouring `//`, `@`, `/* … *\/` (including
 * multi-line blocks) and never treating a marker inside a string literal as a
 * comment — `.asciz "http://x"` keeps its text.
 */
function scanComment(line: string, inBlock: boolean): CommentScan {
  let i = 0;

  if (inBlock) {
    const close = line.indexOf('*/');
    if (close === -1) {
      return { codeStart: 0, codeEnd: 0, commentSpan: { start: 0, end: line.length }, inBlockAfter: true };
    }
    i = close + 2;
  }

  const codeStart = i;

  while (i < line.length) {
    const ch = line[i];

    if (ch === '"') { i = consumeString(line, i, line.length).end; continue; }

    if (ch === '/' && line[i + 1] === '/') {
      return { codeStart, codeEnd: i, commentSpan: { start: i, end: line.length }, inBlockAfter: false };
    }

    if (ch === '/' && line[i + 1] === '*') {
      const close = line.indexOf('*/', i + 2);
      return close === -1
        ? { codeStart, codeEnd: i, commentSpan: { start: i, end: line.length }, inBlockAfter: true }
        : { codeStart, codeEnd: i, commentSpan: { start: i, end: close + 2 }, inBlockAfter: false };
    }

    if (ch === '@' && (i === 0 || /[ \t]/.test(line[i - 1])) && !AT_TYPE_RE.test(line.slice(i))) {
      return { codeStart, codeEnd: i, commentSpan: { start: i, end: line.length }, inBlockAfter: false };
    }

    i++;
  }

  return { codeStart, codeEnd: line.length, inBlockAfter: false };
}

// ── Code region ───────────────────────────────────────────────────────────────

function parseCodeRegion(
  raw: string,
  lineNumber: number,
  scan: CommentScan,
  inMacroBody: boolean
): ParsedLine {
  const base: ParsedLine = {
    lineNumber,
    raw,
    isDirective: false,
    isPreprocessor: false,
    isAssignment: false,
    operands: [],
    missingCommas: [],
    emptyOperands: [],
    inMacroBody,
    comment: scan.commentSpan,
  };

  const code = raw.slice(0, scan.codeEnd);
  let cursor = scan.codeStart;

  // `#include` / `#define` in a .S file is handled by cpp, never by the assembler.
  const firstNonSpace = code.slice(cursor).search(/\S/);
  if (firstNonSpace === -1) { return base; }
  if (code[cursor + firstNonSpace] === '#') {
    return { ...base, isPreprocessor: true };
  }

  // Label prefix, e.g. `loop:` / `.Lfail:` / `1:`
  const labelMatch = LABEL_RE.exec(code.slice(cursor));
  if (labelMatch) {
    const nameStart = cursor + labelMatch[0].indexOf(labelMatch[1]);
    base.label = { name: labelMatch[1], span: { start: nameStart, end: nameStart + labelMatch[1].length } };
    cursor += labelMatch[0].length;
  }

  // Mnemonic or directive
  const mnemMatch = MNEM_RE.exec(code.slice(cursor));
  if (!mnemMatch) { return base; }

  const mnemStart = cursor + mnemMatch[0].length - mnemMatch[1].length;
  const mnemEnd   = mnemStart + mnemMatch[1].length;
  base.mnemonic   = {
    text: mnemMatch[1].toLowerCase(),
    raw: mnemMatch[1],
    span: { start: mnemStart, end: mnemEnd },
  };
  base.isDirective = mnemMatch[1].startsWith('.');
  cursor = mnemEnd;

  // `len = . - msg` is GAS's symbol assignment, not an instruction called `len`.
  const afterMnem = code.slice(cursor, scan.codeEnd);
  const assignIdx = afterMnem.search(/\S/);
  if (assignIdx !== -1 && afterMnem[assignIdx] === '=' && afterMnem[assignIdx + 1] !== '=') {
    return { ...base, isAssignment: true };
  }

  // `add, sp, sp, #16` — a comma where the operand list should begin.
  const strayIdx  = assignIdx;
  if (strayIdx !== -1 && afterMnem[strayIdx] === ',') {
    base.strayCommaAfterMnemonic = { start: cursor + strayIdx, end: cursor + strayIdx + 1 };
    cursor = cursor + strayIdx + 1;
  }

  const { items, unbalanced } = tokenize(code, cursor, scan.codeEnd);
  if (unbalanced) { base.unbalanced = unbalanced; }

  buildOperands(base, items, cursor, scan.codeEnd);
  return base;
}

// ── Tokenizer ─────────────────────────────────────────────────────────────────

type RawItem =
  | { kind: 'token'; text: string; span: Span }
  | { kind: 'comma'; span: Span };

function tokenize(
  text: string,
  from: number,
  to: number
): { items: RawItem[]; unbalanced?: { char: string; span: Span } } {
  const items: RawItem[] = [];
  let unbalanced: { char: string; span: Span } | undefined;
  let i = from;

  while (i < to) {
    const ch = text[i];

    if (ch === ' ' || ch === '\t') { i++; continue; }

    if (ch === ',') {
      items.push({ kind: 'comma', span: { start: i, end: i + 1 } });
      i++;
      continue;
    }

    // A token runs until whitespace or a top-level comma, absorbing any
    // balanced group or string it meets: `[x1, #8]!` and `{v0.16b}[0]` stay whole.
    const start = i;
    while (i < to) {
      const c = text[i];
      if (c === ' ' || c === '\t' || c === ',') { break; }

      if (c === '"') {
        const s = consumeString(text, i, to);
        if (!s.terminated && !unbalanced) { unbalanced = { char: '"', span: { start: i, end: s.end } }; }
        i = s.end;
        continue;
      }

      if (c === '[' || c === '{' || c === '(') {
        const g = consumeGroup(text, i, to);
        if (!g.balanced && !unbalanced) { unbalanced = { char: c, span: { start: i, end: g.end } }; }
        i = g.end;
        continue;
      }

      if (c === ']' || c === '}' || c === ')') {
        if (!unbalanced) { unbalanced = { char: c, span: { start: i, end: i + 1 } }; }
        i++;
        continue;
      }

      i++;
    }

    if (i > start) { items.push({ kind: 'token', text: text.slice(start, i), span: { start, end: i } }); }
  }

  return { items, unbalanced };
}

function consumeString(text: string, i: number, to: number): { end: number; terminated: boolean } {
  let j = i + 1;
  while (j < to) {
    if (text[j] === String.fromCharCode(92)) { j += 2; continue; }
    if (text[j] === '"') { return { end: j + 1, terminated: true }; }
    j++;
  }
  return { end: to, terminated: false };
}

/** Consumes a balanced `[..]`, `{..}` or `(..)` starting at `i`. */
function consumeGroup(text: string, i: number, to: number): { end: number; balanced: boolean } {
  const stack: string[] = [];
  let j = i;

  while (j < to) {
    const ch = text[j];

    if (ch === '"') { j = consumeString(text, j, to).end; continue; }

    if (ch === '[' || ch === '{' || ch === '(') { stack.push(CLOSER[ch]); j++; continue; }

    if (ch === ']' || ch === '}' || ch === ')') {
      const want = stack.pop();
      j++;
      if (want !== ch) { return { end: j, balanced: false }; }
      if (stack.length === 0) { return { end: j, balanced: true }; }
      continue;
    }

    j++;
  }

  return { end: j, balanced: false };
}

// ── Operand assembly ──────────────────────────────────────────────────────────

/**
 * Groups tokens into comma-separated operands and flags the gaps where a comma
 * is missing.
 *
 * `add x0, x1, x2, lsl #3` → four operands, the last one two tokens long.
 * `add sp, sp #16`         → the second group holds `sp` and `#16`, and `sp` is
 *                            not a shift keyword, so the gap is a missing comma.
 */
function buildOperands(line: ParsedLine, items: RawItem[], from: number, to: number): void {
  if (items.length === 0) { return; }

  const groups: { tokens: Token[]; span: Span }[] = [];
  let current: Token[] = [];
  let groupStart = from;
  let sawAnyComma = false;

  const flush = (end: number): void => {
    groups.push({
      tokens: current,
      span: current.length > 0
        ? { start: current[0].span.start, end: current[current.length - 1].span.end }
        : { start: groupStart, end },
    });
    current = [];
  };

  for (const item of items) {
    if (item.kind === 'comma') {
      sawAnyComma = true;
      flush(item.span.start);
      groupStart = item.span.end;
    } else {
      current.push({ text: item.text, span: item.span });
    }
  }
  flush(to);

  // A single trailing empty group only exists because of a trailing comma.
  for (let g = 0; g < groups.length; g++) {
    const grp = groups[g];

    if (grp.tokens.length === 0) {
      if (sawAnyComma) {
        const span = grp.span.end > grp.span.start
          ? grp.span
          : { start: Math.max(from, grp.span.start - 1), end: grp.span.start + 1 };
        line.emptyOperands.push(span);
      }
      continue;
    }

    for (let t = 1; t < grp.tokens.length; t++) {
      if (!isContinuation(grp.tokens, t)) {
        line.missingCommas.push({ start: grp.tokens[t - 1].span.end, end: grp.tokens[t].span.end });
      }
    }

    const text = line.raw.slice(grp.span.start, grp.span.end).trim();
    const operand: Operand = {
      text,
      span: grp.span,
      tokens: grp.tokens,
      kind: 'unknown',
    };
    Object.assign(operand, classifyOperand(text, line.inMacroBody));
    line.operands.push(operand);
  }
}

/**
 * True when `tokens[index]` legitimately follows the previous token with only
 * whitespace between them — the shift/extend suffix syntax and the `!`
 * write-back marker are the only cases in AArch64.
 */
function isContinuation(tokens: Token[], index: number): boolean {
  const prev = tokens[index - 1].text.toLowerCase();
  const cur  = tokens[index].text.toLowerCase();

  if (cur === '!') { return true; }
  if (SHIFT_OPS.has(cur) || EXTEND_OPS.has(cur)) { return true; }
  if (SHIFT_OPS.has(prev) || EXTEND_OPS.has(prev)) { return true; }

  return false;
}

/** Removes a leading `label:` so directive detection works on `foo: .macro bar`. */
function stripLabel(code: string): string {
  const m = LABEL_RE.exec(code);
  return m ? code.slice(m[0].length) : code;
}
