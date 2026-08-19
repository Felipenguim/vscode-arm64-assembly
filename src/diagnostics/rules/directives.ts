/**
 * Directive rules — names that do not exist in GAS, and data values of the
 * wrong type or size.
 *
 * Severities follow what `aarch64-linux-gnu-as` (binutils 2.38) actually does:
 *
 *   .quad 1.56   →  Error:   junk at end of line, first unrecognized character is `.'
 *   .ascii hello →  Error:   junk at end of line, first unrecognized character is `h'
 *   dq 5         →  Error:   unknown mnemonic `dq'
 *   .byte 300    →  Warning: value 0x…012c truncated to 0x…002c
 *
 * so truncation is its own category, and is a warning rather than an error.
 */

import {
  DATA_DIRECTIVES,
  FOREIGN_DIRECTIVES,
  KNOWN_DIRECTIVES,
  STRING_DIRECTIVES,
  floatDirectiveFor,
} from '../../data/directives';
import { finding, type Finding } from '../findings';
import { suggestSymbol, type SymbolIndex } from '../symbolIndex';
import type { Operand, ParsedLine } from '../../parser/types';

/** `.` + every known directive, so suggestions come back ready to insert. */
const DOTTED_DIRECTIVES: ReadonlySet<string> =
  new Set([...KNOWN_DIRECTIVES].map(d => '.' + d));

export function checkDirectives(line: ParsedLine, index?: SymbolIndex): Finding[] {
  if (line.isPreprocessor || line.isAssignment || !line.mnemonic) { return []; }

  const out: Finding[] = [];
  const name = line.mnemonic.text;

  // ── A directive from another assembler ────────────────────────────────────
  const foreign = FOREIGN_DIRECTIVES.get(name);
  if (foreign && !index?.macros.has(line.mnemonic.raw)) {
    const note = foreign.note ? ` — ${foreign.note}` : '';
    out.push(finding(
      line.lineNumber,
      line.mnemonic.span,
      'arm64/foreign-directive',
      'directives',
      `\`${line.mnemonic.raw}\` does not exist in the GNU assembler. The equivalent is \`${foreign.gas}\`${note}.`,
      foreign.mechanical
        ? { title: `Change to ${foreign.gas}`, span: line.mnemonic.span, newText: foreign.gas }
        : undefined
    ));
    return out;
  }

  if (!line.isDirective) { return out; }

  // ── A directive our list does not have ────────────────────────────────────
  if (!KNOWN_DIRECTIVES.has(name.slice(1))) {
    const suggestion = suggestSymbol(name, DOTTED_DIRECTIVES);
    out.push(finding(
      line.lineNumber,
      line.mnemonic.span,
      'arm64/unknown-directive',
      'unknownDirective',
      suggestion
        ? `Unknown directive \`${name}\`. Did you mean \`${suggestion}\`?`
        : `Unknown directive \`${name}\`.`,
      suggestion
        ? { title: `Change to ${suggestion}`, span: line.mnemonic.span, newText: suggestion }
        : undefined
    ));
    return out;
  }

  // ── Value types ───────────────────────────────────────────────────────────
  const data = DATA_DIRECTIVES.get(name);
  if (data) {
    for (const op of line.operands) { checkDataValue(out, line, op, name, data.bytes, data.float); }
  }

  if (STRING_DIRECTIVES.has(name)) {
    for (const op of line.operands) {
      if (op.kind === 'string' || op.kind === 'wildcard') { continue; }
      out.push(finding(
        line.lineNumber,
        op.span,
        'arm64/directive-needs-string',
        'directives',
        `\`${name}\` expects a quoted string. Write \`"${op.text}"\`.`,
        { title: 'Add quotes', span: op.span, newText: `"${op.text}"` }
      ));
    }
  }

  return out;
}

function checkDataValue(
  out: Finding[],
  line: ParsedLine,
  op: Operand,
  directive: string,
  bytes: number,
  isFloatDirective: boolean
): void {
  // Only pure literals are checked. `msg_end - msg` and `SYS_write` are
  // expressions the assembler resolves later, and are none of our business.
  if (op.kind !== 'imm' && op.kind !== 'bareNumber') { return; }

  // ── A float where an integer directive is required ───────────────────────
  if (op.isFloat && !isFloatDirective) {
    const replacement = floatDirectiveFor(bytes);
    out.push(finding(
      line.lineNumber,
      op.span,
      'arm64/directive-float-in-int',
      'directives',
      `\`${directive}\` only takes integers — \`${op.text}\` has a fractional part. ` +
      `Use \`${replacement}\` for ${bytes <= 4 ? 'a 4' : 'an 8'}-byte floating-point value.`,
      {
        title: `Change ${directive} to ${replacement}`,
        span: line.mnemonic!.span,
        newText: replacement,
      }
    ));
    return;
  }

  if (op.value === undefined || isFloatDirective) { return; }

  // ── A value wider than the field ─────────────────────────────────────────
  // GAS accepts anything the field can hold as either signed or unsigned, so
  // `.byte -200` passes while `.byte 300` is truncated.
  const bits  = BigInt(bytes * 8);
  const limit = 1n << bits;
  if (op.value < -limit || op.value >= limit) {
    const truncated = op.value & (limit - 1n);
    out.push(finding(
      line.lineNumber,
      op.span,
      'arm64/data-truncated',
      'dataTruncation',
      `\`${op.text}\` does not fit in ${bytes} byte${bytes > 1 ? 's' : ''} — the GNU assembler ` +
      `truncates it to \`0x${truncated.toString(16).toUpperCase()}\`.`
    ));
  }
}
