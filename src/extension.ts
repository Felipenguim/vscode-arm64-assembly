import * as vscode from 'vscode';
import { Arm64DocumentSymbolProvider } from './providers/documentSymbolProvider';
import { Arm64DefinitionProvider }     from './providers/definitionProvider';
import { Arm64HoverProvider }          from './providers/hoverProvider';
import { Arm64InlayHintProvider }      from './providers/inlayHintProvider';
import { trackRegistersToLine, RegValue } from './providers/registerTracker';
import { Arm64DiagnosticManager }      from './diagnostics/manager';
import { Arm64QuickFixProvider }       from './diagnostics/quickFix';

const LANGUAGE_ID = 'arm64-asm';

/**
 * Called by VS Code when the extension is activated (on first `.s` / `.S` file open).
 *
 * Registered providers:
 *   - DocumentSymbolProvider  → outline panel + breadcrumb
 *   - DefinitionProvider      → F12 / Ctrl+Click go-to-definition for labels
 *   - HoverProvider           → register ABI, instruction docs, numeric base conversions
 *   - InlayHintsProvider      → inline decimal values for hex/binary/octal literals
 *   - DiagnosticManager       → red/yellow squiggles for code that will not assemble
 *
 * Registered commands:
 *   - arm64asm.showRegisterState → show inferred register values at the cursor line
 *   - arm64asm.runDiagnostics    → re-analyse the active file, skipping the debounce
 */
export function activate(context: vscode.ExtensionContext): void {
  const selector    = { language: LANGUAGE_ID };
  const output      = vscode.window.createOutputChannel('ARM64 Register State');
  const diagnostics = new Arm64DiagnosticManager();

  context.subscriptions.push(
    output,
    diagnostics,
    vscode.commands.registerCommand('arm64asm.runDiagnostics', () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document.languageId !== LANGUAGE_ID) {
        vscode.window.showWarningMessage('Open an ARM64 assembly file first.');
        return;
      }
      diagnostics.analyzeNow(editor.document);
    }),
    vscode.languages.registerDocumentSymbolProvider(
      selector,
      new Arm64DocumentSymbolProvider()
    ),
    vscode.languages.registerDefinitionProvider(
      selector,
      new Arm64DefinitionProvider()
    ),
    vscode.languages.registerHoverProvider(
      selector,
      new Arm64HoverProvider()
    ),
    vscode.languages.registerInlayHintsProvider(
      selector,
      new Arm64InlayHintProvider()
    ),
    vscode.languages.registerCodeActionsProvider(
      selector,
      new Arm64QuickFixProvider(diagnostics),
      { providedCodeActionKinds: Arm64QuickFixProvider.providedCodeActionKinds }
    ),
    vscode.commands.registerCommand('arm64asm.showRegisterState', () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document.languageId !== LANGUAGE_ID) {
        vscode.window.showWarningMessage('Open an ARM64 assembly file first.');
        return;
      }

      const line = editor.selection.active.line;
      const { state, functionName } = trackRegistersToLine(editor.document, line);

      output.clear();
      output.show(true);

      const scope = functionName ? `inside: ${functionName}` : 'global scope';
      output.appendLine(`Register state at line ${line + 1} (${scope})\n`);

      if (state.size === 0) {
        output.appendLine('  (no register assignments found above this line)');
        return;
      }

      const known:   [string, RegValue][] = [];
      const unknown: [string, RegValue][] = [];

      for (const entry of [...state.entries()].sort((a, b) => regSortKey(a[0]) - regSortKey(b[0]))) {
        (entry[1].kind === 'unknown' ? unknown : known).push(entry);
      }

      for (const [reg, val] of known) {
        if (val.kind === 'literal') {
          const is32 = reg.startsWith('w');
          output.appendLine(`  ${reg.padEnd(4)} = ${formatHex(val.value, is32)}  (${val.value.toString(10)})`);
        } else if (val.kind === 'address') {
          output.appendLine(`  ${reg.padEnd(4)} = &${val.label}`);
        }
      }

      if (unknown.length > 0) {
        if (known.length > 0) { output.appendLine(''); }
        for (const [reg, val] of unknown) {
          if (val.kind === 'unknown') {
            output.appendLine(`  ${reg.padEnd(4)} = [unknown — ${val.reason}]`);
          }
        }
      }
    })
  );
}

/**
 * Called by VS Code when the extension is deactivated.
 * No persistent resources to clean up beyond the subscriptions handled above.
 */
export function deactivate(): void {
  // intentionally empty
}

// ── Display helpers ───────────────────────────────────────────────────────────

function formatHex(value: bigint, is32bit: boolean): string {
  const isNeg = value < 0n;
  const abs   = isNeg ? -value : value;
  const width = is32bit ? 8 : 16;
  const raw   = abs.toString(16).toUpperCase().padStart(width, '0');
  const parts: string[] = [];
  for (let i = 0; i < raw.length; i += 4) { parts.push(raw.slice(i, i + 4)); }
  return (isNeg ? '-' : '') + '0x' + parts.join('_');
}

function regSortKey(name: string): number {
  const lower = name.toLowerCase();
  if (lower.startsWith('x')) { const n = parseInt(lower.slice(1), 10); return isNaN(n) ? 200 : n; }
  if (lower.startsWith('w')) { const n = parseInt(lower.slice(1), 10); return isNaN(n) ? 200 : 100 + n; }
  return 300;
}
