import * as vscode from 'vscode';
import { resolveMacro } from './macroResolver';

/**
 * Matches a label definition at the start of a line.
 * Group 1: the label name (may start with a dot, e.g. `.Lloop`).
 */
const LABEL_DEF_PATTERN = /^\s*(\.?[a-zA-Z_][a-zA-Z0-9_.]*|[0-9]+)\s*:/;

/**
 * Provides go-to-definition for local labels and macro definitions.
 *
 * - Labels: single-file search (F12 / Ctrl+Click jumps to the label line).
 * - Macros: searches the current file first, then any files listed in
 *   `.include` directives (single-level, no transitive resolution).
 */
export class Arm64DefinitionProvider implements vscode.DefinitionProvider {
  async provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken
  ): Promise<vscode.Location | undefined> {
    // getWordRangeAtPosition with a custom regex handles names containing dots
    // (e.g. `.Lloop`, `.L_done`, `_start`) which the default word splitter would miss.
    const wordRange = document.getWordRangeAtPosition(
      position,
      /\.?[a-zA-Z_][a-zA-Z0-9_.]*/
    );
    if (!wordRange) {
      return undefined;
    }

    const word = document.getText(wordRange);

    // ── 1. Label lookup (single-file) ─────────────────────────────────────
    for (let lineNum = 0; lineNum < document.lineCount; lineNum++) {
      const lineText = document.lineAt(lineNum).text;
      const match = LABEL_DEF_PATTERN.exec(lineText);
      if (match && match[1] === word) {
        return new vscode.Location(
          document.uri,
          new vscode.Range(lineNum, 0, lineNum, lineText.length)
        );
      }
    }

    // ── 2. Macro lookup (current file + .include files) ───────────────────
    const macro = await resolveMacro(document, word);
    if (macro) {
      return new vscode.Location(
        macro.uri,
        new vscode.Range(macro.line, 0, macro.line, 0)
      );
    }

    return undefined;
  }
}
