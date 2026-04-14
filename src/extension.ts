import * as vscode from 'vscode';
import { Arm64DocumentSymbolProvider } from './providers/documentSymbolProvider';
import { Arm64DefinitionProvider }     from './providers/definitionProvider';
import { Arm64HoverProvider }          from './providers/hoverProvider';
import { Arm64InlayHintProvider }      from './providers/inlayHintProvider';

const LANGUAGE_ID = 'arm64-asm';

/**
 * Called by VS Code when the extension is activated (on first `.s` / `.S` file open).
 *
 * Registered providers:
 *   - DocumentSymbolProvider  → outline panel + breadcrumb
 *   - DefinitionProvider      → F12 / Ctrl+Click go-to-definition for labels
 *   - HoverProvider           → register ABI, instruction docs, numeric base conversions
 *   - InlayHintsProvider      → inline decimal values for hex/binary/octal literals
 */
export function activate(context: vscode.ExtensionContext): void {
  const selector = { language: LANGUAGE_ID };

  context.subscriptions.push(
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
    )
  );
}

/**
 * Called by VS Code when the extension is deactivated.
 * No persistent resources to clean up beyond the subscriptions handled above.
 */
export function deactivate(): void {
  // intentionally empty
}
