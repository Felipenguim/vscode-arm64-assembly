import * as vscode from 'vscode';
import { Arm64DocumentSymbolProvider } from './providers/documentSymbolProvider';
import { Arm64DefinitionProvider } from './providers/definitionProvider';
import { Arm64HoverProvider } from './providers/hoverProvider';

const LANGUAGE_ID = 'arm64-asm';

/**
 * Called by VS Code when the extension is activated (on first `.s` / `.S` file open).
 *
 * Registers the three Level-2 language providers:
 * - DocumentSymbolProvider  → outline panel + breadcrumb
 * - DefinitionProvider      → F12 / Ctrl+Click go-to-definition for labels
 * - HoverProvider           → register ABI descriptions on hover
 *
 * Each registration returns a Disposable that is pushed into `context.subscriptions`
 * so VS Code cleans up automatically on extension deactivation or reload.
 */
export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.languages.registerDocumentSymbolProvider(
      { language: LANGUAGE_ID },
      new Arm64DocumentSymbolProvider()
    ),
    vscode.languages.registerDefinitionProvider(
      { language: LANGUAGE_ID },
      new Arm64DefinitionProvider()
    ),
    vscode.languages.registerHoverProvider(
      { language: LANGUAGE_ID },
      new Arm64HoverProvider()
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
