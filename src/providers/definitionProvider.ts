import * as vscode from 'vscode';

/**
 * Matches a label definition at the start of a line.
 * Group 1: the label name (may start with a dot, e.g. `.Lloop`).
 */
const LABEL_DEF_PATTERN = /^\s*(\.?[a-zA-Z_][a-zA-Z0-9_.]*|[0-9]+)\s*:/;

/**
 * Provides go-to-definition for local labels within the same file.
 *
 * Usage: press F12 or Ctrl+Click on any label reference to jump to the line
 * where that label is defined.
 *
 * Scope: single-file only (Level 2). Cross-file macro/include resolution
 * is planned for Level 3.
 */
export class Arm64DefinitionProvider implements vscode.DefinitionProvider {
  provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken
  ): vscode.Location | undefined {
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

    return undefined;
  }
}
