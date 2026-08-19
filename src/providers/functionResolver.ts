import * as vscode from 'vscode';
import * as path from 'path';

// ── Internal regexes ─────────────────────────────────────────────────────────

/** Top-level function label: starts with a letter (not `_` or `.`), ends with `:`. */
const FUNC_DEF_RE  = /^\s*([a-zA-Z][a-zA-Z0-9_]*)\s*:/;
const RET_RE       = /^\s*ret\b/i;
const INCLUDE_RE   = /^\s*\.include\s+"([^"]+)"/i;

/** Strips a leading `//` or `@` comment marker and trims the result. */
const COMMENT_RE   = /^\s*(?:\/\/|@)\s?(.*)/;

/** First comment line looks like a C-style function signature if it contains parens. */
const SIG_RE       = /^[a-zA-Z_*].*\(.*\)\s*$/;

/** @param <name> <register> [— | - | space] <description> */
const PARAM_RE     = /^@param\s+(\S+)\s+(\S+)(?:\s*[—\-]\s*|\s+)(.*)/;

/** @return <register> [— | - | space] <description> */
const RETURN_RE    = /^@return\s+(\S+)(?:\s*[—\-]\s*|\s+)(.*)/;

// ── Public types ─────────────────────────────────────────────────────────────

export interface FunctionParam {
  name: string;
  register: string;
  description: string;
}

export interface FunctionDefinition {
  uri: vscode.Uri;
  line: number;
  signature: string | undefined;
  description: string[];
  params: FunctionParam[];
  ret: { register: string; description: string } | undefined;
  body: string[];
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Resolves a function by name, searching first in `document` and then in any
 * files directly listed in its `.include` directives.
 *
 * Only resolves names that do NOT start with `_` — those are macros by convention.
 */
export async function resolveFunction(
  document: vscode.TextDocument,
  name: string
): Promise<FunctionDefinition | undefined> {
  if (name.startsWith('_')) { return undefined; }

  const local = findFunctionInDocument(document, name, document.uri);
  if (local) { return local; }

  const dir      = path.dirname(document.uri.fsPath);
  const config   = vscode.workspace.getConfiguration('arm64asm');
  const extraPaths = config.get<string[]>('includePaths') ?? [];
  const wsRoot   = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
  const searchDirs = extraPaths.map(p =>
    path.isAbsolute(p) ? p : path.resolve(wsRoot, p)
  );

  for (let i = 0; i < document.lineCount; i++) {
    const inc = INCLUDE_RE.exec(document.lineAt(i).text);
    if (!inc) { continue; }

    const candidates = [
      path.resolve(dir, inc[1]),
      ...searchDirs.map(sd => path.resolve(sd, inc[1])),
    ];

    for (const absPath of candidates) {
      try {
        const uri = vscode.Uri.file(absPath);
        const doc = await vscode.workspace.openTextDocument(uri);
        const found = findFunctionInDocument(doc, name, uri);
        if (found) { return found; }
        break;
      } catch {
        // File not found at this path — try next candidate
      }
    }
  }

  return undefined;
}

// ── Internal helpers ─────────────────────────────────────────────────────────

function findFunctionInDocument(
  doc: vscode.TextDocument,
  name: string,
  uri: vscode.Uri
): FunctionDefinition | undefined {
  for (let i = 0; i < doc.lineCount; i++) {
    const m = FUNC_DEF_RE.exec(doc.lineAt(i).text);
    if (!m || m[1] !== name) { continue; }

    // Collect raw comment lines immediately above (stop at blank / non-comment)
    const rawComments: string[] = [];
    for (let j = i - 1; j >= 0; j--) {
      const cm = COMMENT_RE.exec(doc.lineAt(j).text);
      if (!cm) { break; }
      rawComments.unshift(cm[1].trim());
    }

    // Collect body from the label until `ret` (inclusive), the next top-level
    // function label, or 200 lines — whichever comes first.
    const body: string[] = [doc.lineAt(i).text];
    for (let j = i + 1; j < doc.lineCount && body.length < 200; j++) {
      const lineText = doc.lineAt(j).text;

      // Stop before the next top-level (non-local) label
      if (FUNC_DEF_RE.test(lineText)) { break; }

      body.push(lineText);

      if (RET_RE.test(lineText)) { break; }
    }

    return { uri, line: i, body, ...parseComments(rawComments) };
  }
  return undefined;
}

function parseComments(lines: string[]): {
  signature: string | undefined;
  description: string[];
  params: FunctionParam[];
  ret: { register: string; description: string } | undefined;
} {
  if (lines.length === 0) {
    return { signature: undefined, description: [], params: [], ret: undefined };
  }

  let idx = 0;
  let signature: string | undefined;

  if (SIG_RE.test(lines[0])) {
    signature = lines[0];
    idx = 1;
  }

  const description: string[] = [];
  const params: FunctionParam[]  = [];
  let ret: { register: string; description: string } | undefined;

  for (; idx < lines.length; idx++) {
    const line = lines[idx];

    const pm = PARAM_RE.exec(line);
    if (pm) {
      params.push({ name: pm[1], register: pm[2].toUpperCase(), description: pm[3].trim() });
      continue;
    }

    const rm = RETURN_RE.exec(line);
    if (rm) {
      ret = { register: rm[1].toUpperCase(), description: rm[2].trim() };
      continue;
    }

    description.push(line);
  }

  while (description.length && description[description.length - 1] === '') {
    description.pop();
  }

  return { signature, description, params, ret };
}
