import * as vscode from 'vscode';
import * as path from 'path';

// ── Internal regexes ─────────────────────────────────────────────────────────

const MACRO_DEF_RE = /^\s*\.macro\s+([a-zA-Z_][a-zA-Z0-9_]*)/i;
const MACRO_END_RE = /^\s*\.endm\b/i;
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

export interface MacroParam {
  name: string;
  register: string;
  description: string;
}

export interface MacroDefinition {
  uri: vscode.Uri;
  line: number;                                          // zero-based .macro line
  signature: string | undefined;                         // C-style signature, e.g. "int _close(int fd)"
  description: string[];                                 // plain description lines (no @ tags)
  params: MacroParam[];                                  // @param entries
  ret: { register: string; description: string } | undefined; // @return entry
  body: string[];                                        // .macro … .endm lines
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Resolves a macro by name, searching first in `document` and then in any
 * files directly listed in its `.include` directives.
 *
 * Transitive includes are not followed (Level 2 scope).
 */
export async function resolveMacro(
  document: vscode.TextDocument,
  name: string
): Promise<MacroDefinition | undefined> {
  const local = findMacroInDocument(document, name, document.uri);
  if (local) { return local; }

  const dir = path.dirname(document.uri.fsPath);
  for (let i = 0; i < document.lineCount; i++) {
    const inc = INCLUDE_RE.exec(document.lineAt(i).text);
    if (!inc) { continue; }

    const absPath = path.resolve(dir, inc[1]);
    try {
      const uri = vscode.Uri.file(absPath);
      const doc = await vscode.workspace.openTextDocument(uri);
      const found = findMacroInDocument(doc, name, uri);
      if (found) { return found; }
    } catch {
      // File not found or unreadable — skip silently
    }
  }

  return undefined;
}

// ── Internal helpers ─────────────────────────────────────────────────────────

function findMacroInDocument(
  doc: vscode.TextDocument,
  name: string,
  uri: vscode.Uri
): MacroDefinition | undefined {
  for (let i = 0; i < doc.lineCount; i++) {
    const m = MACRO_DEF_RE.exec(doc.lineAt(i).text);
    if (!m || m[1] !== name) { continue; }

    // Collect raw comment lines immediately above (stop at blank / non-comment)
    const rawComments: string[] = [];
    for (let j = i - 1; j >= 0; j--) {
      const cm = COMMENT_RE.exec(doc.lineAt(j).text);
      if (!cm) { break; }
      rawComments.unshift(cm[1].trim());
    }

    // Collect body from .macro to .endm (inclusive)
    const body: string[] = [doc.lineAt(i).text];
    for (let j = i + 1; j < doc.lineCount; j++) {
      body.push(doc.lineAt(j).text);
      if (MACRO_END_RE.test(doc.lineAt(j).text)) { break; }
    }

    return { uri, line: i, body, ...parseComments(rawComments) };
  }
  return undefined;
}

/**
 * Parses raw comment lines into structured documentation fields.
 *
 * Supported tags (JSDoc-style):
 *   @param <name> <register> [—|-] <description>
 *   @return <register> [—|-] <description>
 */
function parseComments(lines: string[]): {
  signature: string | undefined;
  description: string[];
  params: MacroParam[];
  ret: { register: string; description: string } | undefined;
} {
  if (lines.length === 0) {
    return { signature: undefined, description: [], params: [], ret: undefined };
  }

  let idx = 0;
  let signature: string | undefined;

  // First non-empty line: treat as C-style signature if it contains parens
  if (SIG_RE.test(lines[0])) {
    signature = lines[0];
    idx = 1;
  }

  const description: string[] = [];
  const params: MacroParam[]  = [];
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

  // Drop trailing empty description lines
  while (description.length && description[description.length - 1] === '') {
    description.pop();
  }

  return { signature, description, params, ret };
}
