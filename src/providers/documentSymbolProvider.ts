import * as vscode from 'vscode';

/**
 * Matches a label definition at the start of a line (after optional whitespace).
 *
 * Captures:
 *   Group 1 — the label name, including optional leading dot (e.g. `.Lloop`, `_start`, `1`)
 *
 * The trailing lookahead `(?:$|\/\/|@|\/\*)` ensures the colon ends meaningful
 * content on that line, preventing false positives like `ldr x0, [x1, x2]:`.
 */
const LABEL_PATTERN = /^\s*(\\.?[a-zA-Z_][a-zA-Z0-9_.]*|[0-9]+)\s*:\s*(?:$|\/\/|@|\/\*)/;

/**
 * Matches a GNU AS `.macro` directive and captures the macro name.
 *
 * Captures:
 *   Group 1 — the macro name
 */
const MACRO_PATTERN = /^\s*\.macro\s+([a-zA-Z_][a-zA-Z0-9_]*)/i;

/**
 * Provides document symbols (labels and macros) for the VS Code outline panel
 * and the breadcrumb navigation bar.
 *
 * Labels are shown with a Function icon (SymbolKind.Function).
 * Macros are shown with a Module icon (SymbolKind.Module).
 */
export class Arm64DocumentSymbolProvider implements vscode.DocumentSymbolProvider {
  provideDocumentSymbols(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken
  ): vscode.DocumentSymbol[] {
    const symbols: vscode.DocumentSymbol[] = [];

    for (let lineNum = 0; lineNum < document.lineCount; lineNum++) {
      const line = document.lineAt(lineNum);
      const text = line.text;

      const labelMatch = LABEL_PATTERN.exec(text);
      if (labelMatch) {
        const name = labelMatch[1];
        const nameStart = text.indexOf(name);
        const selectionRange = new vscode.Range(lineNum, nameStart, lineNum, nameStart + name.length);
        symbols.push(new vscode.DocumentSymbol(
          name,
          '',
          vscode.SymbolKind.Function,
          line.range,
          selectionRange
        ));
        continue;
      }

      const macroMatch = MACRO_PATTERN.exec(text);
      if (macroMatch) {
        const name = macroMatch[1];
        // Find the macro name after the `.macro` keyword
        const macroKeywordEnd = text.toLowerCase().indexOf('.macro') + 6;
        const nameStart = text.indexOf(name, macroKeywordEnd);
        const selectionRange = new vscode.Range(lineNum, nameStart, lineNum, nameStart + name.length);
        symbols.push(new vscode.DocumentSymbol(
          name,
          '.macro',
          vscode.SymbolKind.Module,
          line.range,
          selectionRange
        ));
      }
    }

    return symbols;
  }
}
