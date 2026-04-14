import * as vscode from 'vscode';
import { REGISTER_DOCS } from '../data/registers';
import { INSTRUCTION_DOCS } from '../data/instructions';
import { resolveMacro, MacroDefinition } from './macroResolver';

/**
 * Provides hover documentation for AArch64 registers, instructions, macros,
 * and numeric literals.
 *
 * Priority order when the cursor is on a token:
 *   1. Register      — e.g. `x0`, `v3.8b`, `nzcv`
 *   2. Instruction   — e.g. `mov`, `bl`, `b.eq`
 *   3. Macro         — identifier matching a `.macro` definition (local or included)
 *   4. Numeric literal — e.g. `#0xFF`, `0b1010`, `#-64`
 *
 * Register and instruction lookups are case-insensitive.
 * Macro name matching is case-sensitive (GAS convention).
 */
export class Arm64HoverProvider implements vscode.HoverProvider {
  /**
   * Regex for identifiers: captures register and instruction names, including
   * dots for vector arrangements (`v3.8b`) and conditional suffixes (`b.eq`).
   */
  private static readonly IDENT_RE = /[a-zA-Z_][a-zA-Z0-9_.]*/;

  /**
   * Regex for numeric literals (with optional `#` prefix and leading minus).
   *
   * Matched in priority order:
   *   hex    0x / 0X
   *   binary 0b / 0B
   *   octal  leading-zero + octal digits
   *   decimal
   */
  private static readonly NUM_RE =
    /#?-?(?:0[xX][0-9a-fA-F]+|0[bB][01]+|0[0-7]+(?![0-9x])|[0-9]+)/;

  async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken
  ): Promise<vscode.Hover | undefined> {
    // ── 1. Try identifier (register / instruction / macro) ────────────────
    const identRange = document.getWordRangeAtPosition(
      position,
      Arm64HoverProvider.IDENT_RE
    );

    if (identRange) {
      const rawWord = document.getText(identRange);
      const word    = rawWord.toLowerCase();

      // Register takes priority
      const regDoc = REGISTER_DOCS.get(word);
      if (regDoc) {
        return this.buildRegisterHover(word, regDoc, identRange);
      }

      const instrDoc = INSTRUCTION_DOCS.get(word);
      if (instrDoc) {
        return this.buildInstructionHover(word, instrDoc, identRange);
      }

      // Macro — case-sensitive name match; searches current file + .include files
      const macro = await resolveMacro(document, rawWord);
      if (macro) {
        return this.buildMacroHover(rawWord, macro, identRange);
      }
    }

    // ── 2. Try numeric literal ────────────────────────────────────────────
    const numRange = document.getWordRangeAtPosition(
      position,
      Arm64HoverProvider.NUM_RE
    );

    if (numRange) {
      const raw = document.getText(numRange);
      return this.buildNumericHover(raw, numRange);
    }

    return undefined;
  }

  // ── Hover builders ────────────────────────────────────────────────────────

  private buildMacroHover(
    name: string,
    macro: MacroDefinition,
    range: vscode.Range
  ): vscode.Hover {
    const md = new vscode.MarkdownString();
    md.isTrusted = true;

    // ── Signature header (mirrors TypeScript's "(method) name(params): type") ──
    const sigLine = macro.signature ?? name;
    md.appendCodeblock(`(macro) ${sigLine}`, 'c');

    // ── Description ──────────────────────────────────────────────────────────
    const descLines = macro.description.filter(l => l !== '');
    if (descLines.length) {
      md.appendMarkdown('\n' + descLines.join('  \n') + '\n');
    }

    // ── @param entries ────────────────────────────────────────────────────────
    if (macro.params.length) {
      md.appendMarkdown('\n');
      for (const p of macro.params) {
        md.appendMarkdown(
          `*@param* \`${p.name}\` \`${p.register}\` \u2014 ${p.description}  \n`
        );
      }
    }

    // ── @return entry ─────────────────────────────────────────────────────────
    if (macro.ret) {
      md.appendMarkdown('\n');
      md.appendMarkdown(
        `*@return* \`${macro.ret.register}\` \u2014 ${macro.ret.description}\n`
      );
    }

    // ── Body (collapsed under a details/summary when no structured docs) ──────
    const hasStructuredDocs =
      macro.signature !== undefined ||
      macro.description.length > 0  ||
      macro.params.length > 0        ||
      macro.ret !== undefined;

    md.appendMarkdown('\n---\n\n');
    if (hasStructuredDocs) {
      md.appendMarkdown('**Implementation**\n\n');
    }
    md.appendCodeblock(macro.body.join('\n'), 'arm');

    return new vscode.Hover(md, range);
  }

  private buildRegisterHover(
    word: string,
    description: string,
    range: vscode.Range
  ): vscode.Hover {
    const contents = new vscode.MarkdownString();
    contents.isTrusted = true;
    contents.appendMarkdown(`**\`${word.toUpperCase()}\`** — AArch64 Register\n\n`);
    contents.appendMarkdown(description);
    return new vscode.Hover(contents, range);
  }

  private buildInstructionHover(
    word: string,
    description: string,
    range: vscode.Range
  ): vscode.Hover {
    const contents = new vscode.MarkdownString();
    contents.isTrusted = true;
    contents.appendMarkdown(description);
    return new vscode.Hover(contents, range);
  }

  private buildNumericHover(raw: string, range: vscode.Range): vscode.Hover {
    // Strip optional `#` prefix and collect sign.
    const withoutHash = raw.startsWith('#') ? raw.slice(1) : raw;
    const negative    = withoutHash.startsWith('-');
    const digits      = negative ? withoutHash.slice(1) : withoutHash;

    let value: bigint;
    let base: string;

    if (/^0[xX]/.test(digits)) {
      base  = 'Hexadecimal';
      value = BigInt('0x' + digits.slice(2));
    } else if (/^0[bB]/.test(digits)) {
      base  = 'Binary';
      value = BigInt('0b' + digits.slice(2));
    } else if (/^0[0-7]/.test(digits) && digits.length > 1) {
      base  = 'Octal';
      value = this.parseOctal(digits.slice(1));   // strip leading '0'
    } else {
      base  = 'Decimal';
      value = BigInt(digits);
    }

    if (negative) { value = -value; }

    // Represent in all four bases.
    const isNeg = value < 0n;
    const abs   = isNeg ? -value : value;

    const dec = value.toString(10);
    const hex = (isNeg ? '-' : '') + '0x' + abs.toString(16).toUpperCase();
    const bin = (isNeg ? '-' : '') + '0b' + abs.toString(2);
    const oct = (isNeg ? '-' : '') + '0'  + abs.toString(8);

    const contents = new vscode.MarkdownString();
    contents.isTrusted = true;
    contents.appendMarkdown(`**\`${raw}\`** — ${base} literal\n\n`);
    contents.appendMarkdown(`| Base | Value |\n| --- | --- |\n`);
    contents.appendMarkdown(`| Decimal | \`${dec}\` |\n`);
    contents.appendMarkdown(`| Hexadecimal | \`${hex}\` |\n`);
    contents.appendMarkdown(`| Binary | \`${bin}\` |\n`);
    contents.appendMarkdown(`| Octal | \`${oct}\` |\n`);

    return new vscode.Hover(contents, range);
  }

  /** Parse octal digits string (without the leading `0`) using BigInt. */
  private parseOctal(digits: string): bigint {
    let result = 0n;
    for (const ch of digits) {
      result = result * 8n + BigInt(parseInt(ch, 10));
    }
    return result;
  }
}
