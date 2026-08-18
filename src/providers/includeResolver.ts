/**
 * Shared `.include` resolution.
 *
 * `macroResolver.ts` and `functionResolver.ts` each carried a byte-for-byte
 * copy of this logic, and the diagnostics need it a third time — so it lives
 * here now and all three call in.
 *
 * Search order mirrors GAS: the including file's own directory first, then
 * each entry of `arm64asm.includePaths` (the equivalent of `-I`).
 *
 * Transitive includes are not followed — one level only, as elsewhere in the
 * extension (Level 3 of the roadmap).
 */

import * as vscode from 'vscode';
import * as path from 'path';

const INCLUDE_RE = /^\s*\.include\s+"([^"]+)"/i;

/** Directories to search for an included file, in priority order. */
export function includeSearchDirs(documentUri: vscode.Uri): string[] {
  const config     = vscode.workspace.getConfiguration('arm64asm');
  const extraPaths = config.get<string[]>('includePaths') ?? [];
  const wsRoot     = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';

  return [
    path.dirname(documentUri.fsPath),
    ...extraPaths.map(p => (path.isAbsolute(p) ? p : path.resolve(wsRoot, p))),
  ];
}

/** The relative paths named by every `.include "…"` in the document. */
export function includedPaths(document: vscode.TextDocument): string[] {
  const out: string[] = [];
  for (let i = 0; i < document.lineCount; i++) {
    const m = INCLUDE_RE.exec(document.lineAt(i).text);
    if (m) { out.push(m[1]); }
  }
  return out;
}

/** Opens `relativePath` from the first search directory that has it. */
export async function openIncluded(
  document: vscode.TextDocument,
  relativePath: string
): Promise<vscode.TextDocument | undefined> {
  for (const dir of includeSearchDirs(document.uri)) {
    try {
      return await vscode.workspace.openTextDocument(vscode.Uri.file(path.resolve(dir, relativePath)));
    } catch {
      // Not at this path — try the next search directory.
    }
  }
  return undefined;
}

/** Every document reachable through a single level of `.include`. */
export async function openAllIncluded(
  document: vscode.TextDocument
): Promise<vscode.TextDocument[]> {
  const seen = new Set<string>([document.uri.toString()]);
  const out: vscode.TextDocument[] = [];

  for (const rel of includedPaths(document)) {
    const doc = await openIncluded(document, rel);
    if (!doc) { continue; }
    const key = doc.uri.toString();
    if (seen.has(key)) { continue; }
    seen.add(key);
    out.push(doc);
  }

  return out;
}
