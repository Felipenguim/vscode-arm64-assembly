/**
 * Operand rules — shapes no encoding of the instruction accepts.
 *
 * Confirmed against `aarch64-linux-gnu-as` (binutils 2.38):
 *
 *   mov x3, [x4]        →  Error: undefined symbol x4 used as an immediate value
 *   mov x0, =msg        →  Error: bad expression at operand 2
 *   str x0, x1          →  Error: invalid addressing mode at operand 2
 *   cmp x0, w1          →  Error: missing extend operator at operand 2
 *   ins v10.s[9], w0    →  Error: register element index out of range 0 to 3
 *
 * The safety rule from `instructionSignatures.ts` applies here: a mnemonic
 * with no table entry is never reported.
 */

import { INSTRUCTION_SIGNATURES, OPERAND_HINTS } from '../../data/instructionSignatures';
import { matchForm, maxLaneIndex, type Form, type MatchFailure } from '../../parser/formSpec';
import { finding, type Finding } from '../findings';
import type { Operand, ParsedLine } from '../../parser/types';

export function checkOperands(line: ParsedLine): Finding[] {
  if (line.isPreprocessor || line.isDirective || line.isAssignment || !line.mnemonic) { return []; }

  const out: Finding[] = [];

  // Lane ranges do not need the signature table, so they are checked for every
  // instruction — including ones we have no forms for.
  out.push(...checkLaneRanges(line));

  const forms = INSTRUCTION_SIGNATURES.get(line.mnemonic.text);
  if (!forms || forms.length === 0) { return out; }

  // A macro parameter can expand to any number of operands, so arity means
  // nothing on these lines.
  if (line.operands.some(op => op.kind === 'wildcard')) { return out; }

  // A line that is already broken in another way would only produce noise here.
  if (line.missingCommas.length > 0 || line.emptyOperands.length > 0
      || line.unbalanced || line.strayCommaAfterMnemonic) {
    return out;
  }

  const results: { failure: MatchFailure; operandIndex?: number }[] = [];

  for (const form of forms) {
    const result = matchForm(form, line.operands);
    if (result.ok) { return out; }
    results.push({ failure: result.failure!, operandIndex: result.operandIndex });
  }

  // Arity is decided up front rather than by ranking. `add x0, x1` has too few
  // operands for *every* form, so a count complaint is the honest message;
  // `cmp x0, w1` has a count some form accepts, so the real complaint is the
  // mixed register widths, and the arity failures are just noise.
  const count = line.operands.length;
  const countFitsSomeForm = forms.some(f => {
    const required = f.specs.filter(s => !s.optional).length;
    return count >= required && count <= f.specs.length;
  });

  if (!countFitsSomeForm) {
    out.push(describe(line, forms, 'arity', undefined));
    return out;
  }

  const specific = results.filter(r => r.failure !== 'arity');
  const best = specific.length > 0
    ? specific.reduce((a, b) => (rank(b) > rank(a) ? b : a))
    : undefined;

  out.push(best
    ? describe(line, forms, best.failure, best.operandIndex)
    : describe(line, forms, 'arity', undefined));
  return out;
}

/**
 * Higher wins. A specific diagnosis (mixed widths, mismatched arrangements)
 * beats a plain "wrong kind of operand"; among equals, the match that got
 * furthest describes the line best.
 */
function rank(r: { failure: MatchFailure; operandIndex?: number }): number {
  const specificity = r.failure === 'width' || r.failure === 'arrangement' || r.failure === 'fpsize'
    ? 100
    : 10;
  return specificity + (r.operandIndex ?? 0);
}

function describe(
  line: ParsedLine,
  forms: readonly Form[],
  failure: MatchFailure,
  operandIndex: number | undefined
): Finding {
  const mnemonic = line.mnemonic!.raw;
  const operand = operandIndex !== undefined ? line.operands[operandIndex] : undefined;
  const span = operand?.span ?? line.mnemonic!.span;
  const accepted = `Accepted forms: ${forms.map(f => `\`${mnemonic} ${f.raw}\``).join(', ')}.`;

  switch (failure) {
    case 'width':
      return finding(
        line.lineNumber, span, 'arm64/register-width-mismatch', 'operands',
        `Mixed register widths in \`${mnemonic}\`: use all \`x\` (64-bit) or all \`w\` (32-bit).`
      );

    case 'arrangement':
      return finding(
        line.lineNumber, span, 'arm64/vector-arrangement-mismatch', 'vectors',
        `Mismatched vector arrangement in \`${mnemonic}\`: ` +
        `${describeArrangements(line.operands)} — every operand must use the same arrangement.`
      );

    case 'fpsize':
      return finding(
        line.lineNumber, span, 'arm64/fp-size-mismatch', 'operands',
        `Mixed floating-point register sizes in \`${mnemonic}\`: ` +
        `the operands must all be the same width.`
      );

    case 'arity': {
      const counts = [...new Set(forms.map(f => f.specs.filter(s => !s.optional).length))]
        .sort((a, b) => a - b);
      return finding(
        line.lineNumber, span, 'arm64/operand-count', 'operands',
        `\`${mnemonic}\` was given ${line.operands.length} operand(s); ` +
        `it expects ${counts.join(' or ')}. ${accepted}`
      );
    }

    default: {
      const hint = operand ? OPERAND_HINTS.get(`${line.mnemonic!.text}:${operand.kind}`) : undefined;
      return finding(
        line.lineNumber, span, 'arm64/invalid-operand', 'operands',
        hint
          ? `${hint} ${accepted}`
          : `\`${operand?.text ?? ''}\` is not a valid operand for \`${mnemonic}\`. ${accepted}`
      );
    }
  }
}

function describeArrangements(operands: readonly Operand[]): string {
  const seen = operands
    .filter(o => o.kind === 'vreg' && o.arrangement)
    .map(o => `\`.${o.arrangement}\``);
  return [...new Set(seen)].join(' vs ');
}

/**
 * `v10.s[9]` — a 32-bit element leaves only four lanes in a 128-bit register.
 *
 * `vectorArrangements.ts` already computed this to print a "⚠ Index out of
 * range" note inside the hover; here it becomes a real diagnostic.
 */
function checkLaneRanges(line: ParsedLine): Finding[] {
  const out: Finding[] = [];

  for (const op of line.operands) {
    if (op.kind !== 'vlane' || op.arrangement === undefined || op.laneIndex === undefined) {
      continue;
    }
    const max = maxLaneIndex(op.arrangement);
    if (max === undefined || op.laneIndex <= max) { continue; }

    out.push(finding(
      line.lineNumber, op.span, 'arm64/lane-out-of-range', 'vectors',
      `Lane index out of range: \`.${op.arrangement}\` has ${max + 1} lanes, ` +
      `so the index runs from 0 to ${max}.`
    ));
  }

  return out;
}
