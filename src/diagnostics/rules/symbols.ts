/**
 * Symbol rules — references to a label, macro, or `.equ` name that nothing in
 * this file or its `.include`s defines.
 *
 * Everything here is a warning, never an error: `arm64asm.includePaths` may not
 * be configured, and a symbol may legitimately be resolved at link time. The
 * value of the rule is the *suggestion* — `b ret_x` when `.ret_x:` exists is
 * exactly the mistake this catches.
 */

import { finding, type Finding } from '../findings';
import { suggestSymbol, type SymbolIndex } from '../symbolIndex';
import type { Operand, ParsedLine, Span } from '../../parser/types';

/** Mnemonic → index of the operand that names a symbol. */
const TARGET_OPERAND: Record<string, number> = {
  b: 0, bl: 0,
  cbz: 1, cbnz: 1,
  tbz: 2, tbnz: 2,
  adr: 1, adrp: 1,
};

/**
 * Mnemonics whose target routinely lives in another object file.
 *
 * `bl print_int` is a call the linker resolves, so a near miss against a local
 * name is not evidence of a typo — suggesting `print_uint` there would be
 * actively misleading. For these, only a local label (`.Lfoo`) is reported.
 */
const LINKS_EXTERNALLY = new Set(['bl']);

/** Data directives whose operands may name a symbol. */
const DATA_DIRECTIVES = new Set(['.word', '.quad', '.xword', '.dword', '.long', '.4byte', '.8byte']);

export function checkSymbols(line: ParsedLine, index: SymbolIndex): Finding[] {
  const out: Finding[] = [];
  if (line.isPreprocessor || !line.mnemonic) { return out; }

  const mnemonic = line.mnemonic.text;

  // ── Branch and address-of targets ────────────────────────────────────────
  const targetIndex = mnemonic.startsWith('b.') ? 0 : TARGET_OPERAND[mnemonic];
  if (targetIndex !== undefined) {
    const op = line.operands[targetIndex];
    if (op) { report(out, line, op, op.text, index, undefined, LINKS_EXTERNALLY.has(mnemonic)); }
  }

  // ── `ldr x0, =msg` ────────────────────────────────────────────────────────
  for (const op of line.operands) {
    if (op.kind !== 'ldrLiteral') { continue; }
    const inner = op.text.slice(1).trim();
    if (!isPlainIdentifier(inner)) { continue; }
    report(out, line, op, inner, index, { start: op.span.start + 1, end: op.span.end });
  }

  // ── `.quad some_label` ────────────────────────────────────────────────────
  if (line.isDirective && DATA_DIRECTIVES.has(mnemonic)) {
    for (const op of line.operands) {
      if (op.kind !== 'symbol') { continue; }
      report(out, line, op, op.text, index);
    }
  }

  // ── A mnemonic that is neither an instruction nor a defined macro ─────────
  // Handled by the caller, which knows the instruction set.

  return out;
}

/**
 * Reports `name` when nothing defines it. `span` overrides the underline range,
 * used by `=symbol` so the `=` itself is not underlined.
 */
function report(
  out: Finding[],
  line: ParsedLine,
  op: Operand,
  name: string,
  index: SymbolIndex,
  span?: Span,
  externalOk = false
): void {
  if (op.kind === 'wildcard') { return; }
  if (!isPlainIdentifier(name)) { return; }
  if (index.defined.has(name)) { return; }

  const where = span ?? op.span;
  const isLocal = name.startsWith('.');
  const suggestion = externalOk ? undefined : suggestSymbol(name, index.defined);

  // A plain name with no near miss is almost always resolved at link time —
  // `bl print_chars` against a sibling object file is normal, not a mistake.
  // What is worth reporting is a near miss (`b ret_x` when `.ret_x:` exists)
  // and a local label, which by definition cannot come from the linker.
  if (!suggestion && !isLocal) { return; }

  out.push(finding(
    line.lineNumber,
    where,
    'arm64/unknown-symbol',
    'symbols',
    suggestion
      ? `\`${name}\` is not defined in this file or its \`.include\`s. Did you mean \`${suggestion}\`?`
      : `Local label \`${name}\` is not defined in this file or its \`.include\`s.`,
    suggestion ? { title: `Change to ${suggestion}`, span: where, newText: suggestion } : undefined
  ));
}

/**
 * True for a name that can only be a symbol.
 *
 * Numeric local labels (`1f`, `2b`) and expressions (`msg_end - msg`) are
 * deliberately excluded — resolving those is not this rule's job.
 */
function isPlainIdentifier(text: string): boolean {
  return /^\.?[A-Za-z_$][A-Za-z0-9_.$]*$/.test(text);
}

/** Reports a mnemonic that is neither a known instruction nor a defined macro. */
export function checkUnknownMnemonic(line: ParsedLine, index: SymbolIndex): Finding[] {
  if (!line.mnemonic || line.isDirective || line.isPreprocessor || line.isAssignment) { return []; }

  const name = line.mnemonic.raw;
  if (index.macros.has(name)) { return []; }
  if (index.defined.has(name)) { return []; }

  // Project convention, also encoded in the TextMate grammar's `macro_calls`
  // rule: a leading `_` means a macro. Those often come from a library reached
  // through a second level of `.include`, which the index does not follow.
  if (name.startsWith('_')) { return []; }

  const suggestion = suggestSymbol(name, index.macros);

  return [finding(
    line.lineNumber,
    line.mnemonic.span,
    'arm64/unknown-mnemonic',
    'symbols',
    suggestion
      ? `\`${name}\` is not an AArch64 instruction or a defined macro. Did you mean \`${suggestion}\`?`
      : `\`${name}\` is not an AArch64 instruction, nor a macro defined in this file or its \`.include\`s.`,
    suggestion ? { title: `Change to ${suggestion}`, span: line.mnemonic.span, newText: suggestion } : undefined
  )];
}
