/**
 * Syntax rules — the things that genuinely stop `as` from assembling a line,
 * plus the one style rule about the `#` prefix.
 */

import { isKnownMnemonic } from '../../data/mnemonics';
import { finding, type Finding } from '../findings';
import type { ParsedLine } from '../../parser/types';

/** Branch mnemonics whose operand is a label, never an immediate. */
const BRANCH_TARGETS = new Set(['b', 'bl', 'br', 'blr', 'ret']);

export function checkSyntax(line: ParsedLine): Finding[] {
  const out: Finding[] = [];

  if (line.isPreprocessor) { return out; }

  // ── A comma where the operand list should start: `add, sp, sp, #16` ────────
  if (line.strayCommaAfterMnemonic) {
    out.push(finding(
      line.lineNumber,
      line.strayCommaAfterMnemonic,
      'arm64/stray-comma',
      'syntax',
      'Stray comma after the mnemonic — only whitespace separates a mnemonic from its first operand.',
      { title: 'Remove the comma', newText: '' }
    ));
  }

  // Only real instructions have a comma-strict operand list. `.macro _open path,
  // flags` declares its parameters space-separated, and a macro *call* may pass
  // its arguments the same way — neither is a missing comma.
  const isInstruction = !!line.mnemonic && !line.isDirective && isKnownMnemonic(line.mnemonic.text);

  if (isInstruction) {
    // ── Two operands side by side with no comma: `add sp, sp #16` ────────────
    for (const span of line.missingCommas) {
      out.push(finding(
        line.lineNumber,
        span,
        'arm64/missing-comma',
        'syntax',
        'Missing comma between operands.',
        { title: 'Insert comma', span: { start: span.start, end: span.start }, newText: ',' }
      ));
    }

    // ── `add x0,, x1` or a trailing comma ──────────────────────────────────
    for (const span of line.emptyOperands) {
      out.push(finding(
        line.lineNumber,
        span,
        'arm64/empty-operand',
        'syntax',
        'Empty operand: a comma with nothing on one side of it.'
      ));
    }
  }

  // ── Unbalanced delimiters ──────────────────────────────────────────────────
  if (line.unbalanced) {
    const c = line.unbalanced.char;
    out.push(c === '"'
      ? finding(
          line.lineNumber, line.unbalanced.span,
          'arm64/unterminated-string', 'syntax',
          'Unterminated string — no closing quote.')
      : finding(
          line.lineNumber, line.unbalanced.span,
          'arm64/unbalanced-bracket', 'syntax',
          `Unbalanced \`${c}\` — no matching delimiter.`));
  }

  // ── Immediate written without `#` ──────────────────────────────────────────
  // Only on real instructions: a macro call like `_write 1, msg, 13` passes
  // plain numbers as arguments, and those must not be flagged.
  if (isInstruction && !isBranch(line.mnemonic!.text)) {
    for (const op of line.operands) {
      if (op.kind !== 'bareNumber') { continue; }
      out.push(finding(
        line.lineNumber,
        op.span,
        'arm64/missing-hash',
        'immediateHash',
        `Immediate \`${op.text}\` written without \`#\`. The GNU assembler accepts this, but \`#${op.text}\` is the canonical AArch64 form.`,
        { title: `Write as #${op.text}`, span: { start: op.span.start, end: op.span.start }, newText: '#' }
      ));
    }
  }

  return out;
}

function isBranch(mnemonic: string): boolean {
  return BRANCH_TARGETS.has(mnemonic) || mnemonic.startsWith('b.');
}
