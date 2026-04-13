import * as vscode from 'vscode';
import { REGISTER_DOCS } from '../data/registers';

/**
 * Provides hover documentation for AArch64 registers.
 *
 * When the user hovers over a register name (e.g. `x0`, `v3`, `nzcv`), a
 * Markdown tooltip is shown with the register's ABI role and description.
 *
 * Lookup is case-insensitive: `X0`, `x0`, and `X0` all resolve to the same entry.
 * System registers accessed via `MRS x0, NZCV` are also handled correctly.
 */
export class Arm64HoverProvider implements vscode.HoverProvider {
  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken
  ): vscode.Hover | undefined {
    // Use a custom word range that captures register names including dots
    // in vector arrangement suffixes (e.g. `v3.8b`).
    const wordRange = document.getWordRangeAtPosition(
      position,
      /[a-zA-Z_][a-zA-Z0-9_.]*/
    );
    if (!wordRange) {
      return undefined;
    }

    const word = document.getText(wordRange).toLowerCase();
    const description = REGISTER_DOCS.get(word);

    if (!description) {
      return undefined;
    }

    const contents = new vscode.MarkdownString();
    contents.isTrusted = true;
    contents.appendMarkdown(`**\`${word.toUpperCase()}\`** — AArch64 Register\n\n`);
    contents.appendMarkdown(description);

    return new vscode.Hover(contents, wordRange);
  }
}
