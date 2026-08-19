/**
 * Collects every name a file defines, so the symbol rules can tell a typo from
 * a real reference.
 *
 * Pure: it takes documents as `string[]`. Fetching the `.include`d files is the
 * caller's job (see `providers/includeResolver.ts`), which keeps this testable
 * and keeps `vscode` out of the analysis core.
 */

const BACKSLASH = String.fromCharCode(92);

const LABEL_RE   = /^[ \t]*(\.?[A-Za-z_$][A-Za-z0-9_.$]*|[0-9]+)[ \t]*:/;
const MACRO_RE   = /^[ \t]*\.macro[ \t]+([A-Za-z_][A-Za-z0-9_]*)/i;
const EQU_RE     = /^[ \t]*\.(?:equ|equiv|eqv|set)[ \t]+([A-Za-z_.$][A-Za-z0-9_.$]*)/i;
/** `.global foo` and friends promise the linker will supply the symbol. */
const DECLARE_RE =
  /^[ \t]*\.(?:global|globl|extern|weak|hidden|protected|internal|comm|lcomm|type|size)[ \t]+([A-Za-z_.$][A-Za-z0-9_.$]*)/i;
/** `alias .req x19` introduces a register alias usable as an operand. */
const REQ_RE     = /^[ \t]*([A-Za-z_][A-Za-z0-9_]*)[ \t]+\.req\b/i;
/** GAS symbol assignment: `len = . - msg`. */
const ASSIGN_RE  = /^[ \t]*([A-Za-z_.$][A-Za-z0-9_.$]*)[ \t]*=[^=]/;
const MACRO_PARAMS_RE = /^[ \t]*\.macro[ \t]+[A-Za-z_][A-Za-z0-9_]*[ \t]*(.*)$/i;

export interface SymbolIndex {
  /** Everything usable as a branch target, `.equ` name, or data reference. */
  defined: ReadonlySet<string>;
  /** Names introduced by `.macro`, so a macro call is not an unknown mnemonic. */
  macros: ReadonlySet<string>;
}

/**
 * Builds the index from the document under analysis plus its included files.
 * `documents[0]` is expected to be the document being linted.
 */
export function buildSymbolIndex(documents: string[][]): SymbolIndex {
  const defined = new Set<string>();
  const macros  = new Set<string>();

  for (const lines of documents) {
    collectInto(lines, defined, macros);
  }

  return { defined, macros };
}

function collectInto(lines: string[], defined: Set<string>, macros: Set<string>): void {
  for (const raw of lines) {
    const line = stripComment(raw);
    if (line.trim().length === 0) { continue; }

    const label = LABEL_RE.exec(line);
    if (label) { defined.add(label[1]); }

    const macro = MACRO_RE.exec(line);
    if (macro) {
      macros.add(macro[1]);
      defined.add(macro[1]);

      // Parameters are in scope for the whole body; treating them as defined
      // avoids flagging `\dest` style references after substitution.
      const params = MACRO_PARAMS_RE.exec(line);
      if (params) {
        for (const p of params[1].split(/[\s,]+/)) {
          const name = p.split('=')[0].trim();
          if (name.length > 0) { defined.add(name); }
        }
      }
    }

    const equ = EQU_RE.exec(line);
    if (equ) { defined.add(equ[1]); }

    const declared = DECLARE_RE.exec(line);
    if (declared) { defined.add(declared[1]); }

    const req = REQ_RE.exec(line);
    if (req) { defined.add(req[1]); }

    const assign = ASSIGN_RE.exec(line);
    if (assign) { defined.add(assign[1]); }
  }
}

/**
 * A deliberately cheap comment strip — this runs over included files only, to
 * find definitions, so it does not need the full fidelity of `lineParser`.
 */
function stripComment(line: string): string {
  const markers = ['//', '/*'];
  let cut = line.length;
  for (const m of markers) {
    const i = line.indexOf(m);
    if (i !== -1 && i < cut) { cut = i; }
  }
  const at = line.indexOf('@');
  if (at > 0 && /[ \t]/.test(line[at - 1]) && at < cut) { cut = at; }
  return line.slice(0, cut);
}

// ── Suggestions ───────────────────────────────────────────────────────────────

/**
 * The closest defined name to `name`, or `undefined` when nothing is close
 * enough to be worth suggesting.
 *
 * This is what turns "símbolo não encontrado" into something actionable:
 * `b ret_x` when the label is `.ret_x` is a distance of exactly 1.
 */
export function suggestSymbol(name: string, defined: ReadonlySet<string>): string | undefined {
  const budget = name.length <= 4 ? 1 : 2;
  let best: string | undefined;
  let bestRank: [number, number, number] = [budget + 1, -1, -1];

  for (const candidate of defined) {
    if (candidate === name) { return undefined; }
    if (Math.abs(candidate.length - name.length) > budget) { continue; }

    const d = distance(name, candidate, budget);
    if (d > budget) { continue; }

    // Ties are common — `.elif` is two edits from both `.else` and `.elseif`.
    // Break them on two signals, in order: whether the written name is an
    // abbreviation of the candidate (`.elif` ⊂ `.elseif`, but not ⊂ `.else`),
    // then on how much of the prefix they share.
    const rank: [number, number, number] = [
      d,
      isSubsequence(name, candidate) ? 1 : 0,
      commonPrefix(name, candidate),
    ];

    if (rank[0] < bestRank[0]
      || (rank[0] === bestRank[0] && rank[1] > bestRank[1])
      || (rank[0] === bestRank[0] && rank[1] === bestRank[1] && rank[2] > bestRank[2])) {
      bestRank = rank;
      best = candidate;
    }
  }

  return best;
}

function commonPrefix(a: string, b: string): number {
  const max = Math.min(a.length, b.length);
  let i = 0;
  while (i < max && a[i] === b[i]) { i++; }
  return i;
}

/** True when every character of `a` appears in `b`, in order. */
function isSubsequence(a: string, b: string): boolean {
  let i = 0;
  for (let j = 0; j < b.length && i < a.length; j++) {
    if (a[i] === b[j]) { i++; }
  }
  return i === a.length;
}

/** Levenshtein distance, giving up as soon as it exceeds `budget`. */
function distance(a: string, b: string, budget: number): number {
  const la = a.length;
  const lb = b.length;
  let prev = new Array<number>(lb + 1);
  let curr = new Array<number>(lb + 1);

  for (let j = 0; j <= lb; j++) { prev[j] = j; }

  for (let i = 1; i <= la; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) { rowMin = curr[j]; }
    }
    if (rowMin > budget) { return budget + 1; }
    const swap = prev; prev = curr; curr = swap;
  }

  return prev[lb];
}

/** Strips a `\` macro-parameter marker so callers can test the bare name. */
export function isMacroExpansion(text: string): boolean {
  return text.includes(BACKSLASH);
}
