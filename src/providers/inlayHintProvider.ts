import * as vscode from 'vscode';

/**
 * Provides inline decimal hints for non-decimal numeric literals.
 *
 * When a file contains hex (0xFF), binary (0b1010), or octal (017) literals,
 * a dim annotation showing the decimal equivalent appears immediately after
 * the number token — e.g. `#0xFF  ‣ 255`.
 *
 * The feature mirrors the "inlay type hints" found in languages like Rust and
 * TypeScript, but for numeric base conversions.  Decimal literals are left
 * unannotated (they are already in the most readable form).
 *
 * Uses BigInt internally so 64-bit unsigned values are represented exactly.
 */
export class Arm64InlayHintProvider implements vscode.InlayHintsProvider {
  /**
   * Matches any numeric literal that may appear in ARM64 assembly, including
   * an optional `#` immediate prefix and an optional leading minus sign.
   *
   * Capture groups:
   *   1  optional `#`
   *   2  optional `-`
   *   3  `0x` / `0X` prefix  (hex)
   *   4  hex digits
   *   5  `0b` / `0B` prefix  (binary)
   *   6  binary digits
   *   7  octal literal (leading 0 + at least one octal digit)
   *   8  decimal digits
   */
  private static readonly NUM_RE =
    /(#?)(-?)(?:(0[xX])([0-9a-fA-F]+)|(0[bB])([01]+)|(0[0-7]+(?![0-9]))|([0-9]+))/g;

  provideInlayHints(
    document: vscode.TextDocument,
    range: vscode.Range,
    _token: vscode.CancellationToken
  ): vscode.InlayHint[] {
    const hints: vscode.InlayHint[] = [];

    for (let li = range.start.line; li <= range.end.line; li++) {
      const text = document.lineAt(li).text;
      // Strip trailing comments before scanning so we don't annotate numbers
      // inside comment text.
      const codePart = this.stripComment(text);

      Arm64InlayHintProvider.NUM_RE.lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = Arm64InlayHintProvider.NUM_RE.exec(codePart)) !== null) {
        const negative = match[2] === '-';
        let value: bigint;
        let isDecimal = false;

        if (match[3]) {
          // Hexadecimal
          value = BigInt('0x' + match[4]);
        } else if (match[5]) {
          // Binary
          value = BigInt('0b' + match[6]);
        } else if (match[7]) {
          // Octal (GAS style: leading zero)
          value = this.parseOctal(match[7]);
        } else {
          // Decimal — no hint needed
          isDecimal = true;
          value = BigInt(match[8]);
        }

        if (isDecimal) {
          continue;
        }

        if (negative) {
          value = -value;
        }

        // Place the hint at the character immediately after the full match.
        const endChar = match.index + match[0].length;
        const pos = new vscode.Position(li, endChar);

        const hint = new vscode.InlayHint(
          pos,
          ` = ${value.toString()}`,
          vscode.InlayHintKind.Type
        );
        hint.paddingLeft = false;
        hints.push(hint);
      }
    }

    return hints;
  }

  /** Parse a GAS-style octal string (e.g. `0377`) using BigInt arithmetic. */
  private parseOctal(s: string): bigint {
    // Strip leading zero — remaining digits are the octal value.
    const digits = s.startsWith('0') ? s.slice(1) : s;
    let result = 0n;
    for (const ch of digits) {
      result = result * 8n + BigInt(parseInt(ch, 10));
    }
    return result;
  }

  /**
   * Return the portion of `line` before any line comment (`//` or `@`).
   * Block comments (`/* … *\/`) are left to the regex — they rarely span one
   * line in practice and false positives in multi-line blocks are harmless.
   */
  private stripComment(line: string): string {
    const slashIdx = line.indexOf('//');
    const atIdx    = line.indexOf('@');

    if (slashIdx === -1 && atIdx === -1) { return line; }
    if (slashIdx === -1) { return line.slice(0, atIdx); }
    if (atIdx    === -1) { return line.slice(0, slashIdx); }
    return line.slice(0, Math.min(slashIdx, atIdx));
  }
}
