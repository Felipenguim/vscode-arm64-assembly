/**
 * The only layer of the linter that knows about VS Code.
 *
 * Owns the `DiagnosticCollection`, the debounce timers, and the status-bar
 * counter. Everything it displays comes from `analyze()`, which is pure.
 *
 * Because the findings land in a `DiagnosticCollection`, the built-in Problems
 * panel handles navigation for free: F8 / Shift+F8 step through them and
 * Ctrl+Shift+M opens the panel.
 */

import * as vscode from 'vscode';
import { analyze } from './analyze';
import { buildSymbolIndex } from './symbolIndex';
import { openAllIncluded } from '../providers/includeResolver';
import type { Finding, FindingCategory } from './findings';

const LANGUAGE_ID = 'arm64-asm';
const DEFAULT_DELAY = 300;

/** Falls back to these when a setting is missing or misspelled. */
const DEFAULT_SEVERITY: Record<FindingCategory, string> = {
  syntax: 'error',
  operands: 'error',
  directives: 'error',
  unknownDirective: 'warning',
  dataTruncation: 'warning',
  symbols: 'warning',
  immediateHash: 'warning',
  vectors: 'error',
};

export class Arm64DiagnosticManager implements vscode.Disposable {
  private readonly collection: vscode.DiagnosticCollection;
  private readonly status: vscode.StatusBarItem;
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly fixes = new Map<string, Finding[]>();
  private readonly disposables: vscode.Disposable[] = [];

  constructor() {
    this.collection = vscode.languages.createDiagnosticCollection('arm64asm');

    this.status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 90);
    this.status.command = 'workbench.actions.view.problems';
    this.status.tooltip =
      'ARM64: problems in this file — click to open the Problems panel (F8 jumps to the next one)';

    this.disposables.push(
      this.collection,
      this.status,
      vscode.workspace.onDidOpenTextDocument(doc => this.schedule(doc, true)),
      vscode.workspace.onDidSaveTextDocument(doc => this.schedule(doc, true)),
      vscode.workspace.onDidChangeTextDocument(e => this.schedule(e.document, false)),
      vscode.workspace.onDidCloseTextDocument(doc => this.forget(doc)),
      vscode.window.onDidChangeActiveTextEditor(() => this.updateStatusBar()),
      vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('arm64asm.diagnostics')) { this.refreshAll(); }
      })
    );

    this.refreshAll();
  }

  /** Re-analyses every currently open ARM64 document. */
  refreshAll(): void {
    for (const doc of vscode.workspace.textDocuments) {
      this.schedule(doc, true);
    }
  }

  /** Analyses `document` now, ignoring the debounce. */
  analyzeNow(document: vscode.TextDocument): void {
    this.cancel(document.uri.toString());
    this.run(document);
  }

  dispose(): void {
    for (const t of this.timers.values()) { clearTimeout(t); }
    this.timers.clear();
    for (const d of this.disposables) { d.dispose(); }
  }

  // ── Scheduling ──────────────────────────────────────────────────────────────

  private schedule(document: vscode.TextDocument, immediate: boolean): void {
    if (document.languageId !== LANGUAGE_ID) { return; }

    const key = document.uri.toString();
    this.cancel(key);

    if (!this.enabled()) {
      this.collection.delete(document.uri);
      this.updateStatusBar();
      return;
    }

    if (immediate) {
      this.run(document);
      return;
    }

    const delay = this.delay();
    this.timers.set(key, setTimeout(() => {
      this.timers.delete(key);
      this.run(document);
    }, delay));
  }

  private cancel(key: string): void {
    const existing = this.timers.get(key);
    if (existing !== undefined) {
      clearTimeout(existing);
      this.timers.delete(key);
    }
  }

  private forget(document: vscode.TextDocument): void {
    this.cancel(document.uri.toString());
    this.collection.delete(document.uri);
    this.fixes.delete(document.uri.toString());
    this.updateStatusBar();
  }

  // ── Analysis ────────────────────────────────────────────────────────────────

  private run(document: vscode.TextDocument): void {
    if (document.languageId !== LANGUAGE_ID) { return; }

    const version = document.version;

    void this.buildContext(document).then(symbols => {
      // The user kept typing while the includes were being opened; a newer run
      // is already queued, so this result is stale.
      if (document.version !== version) { return; }

      const lines = document.getText().split(/\r?\n/);
      const findings = analyze(lines, { symbols });

      const diagnostics: vscode.Diagnostic[] = [];
      const fixes: Finding[] = [];
      for (const f of findings) {
        const severity = this.severityFor(f.category);
        if (severity === undefined) { continue; }
        diagnostics.push(toDiagnostic(f, severity));
        if (f.fix) { fixes.push(f); }
      }

      this.collection.set(document.uri, diagnostics);
      this.fixes.set(document.uri.toString(), fixes);
      this.updateStatusBar();
    });
  }

  /** Reads the document's `.include`s and indexes every symbol they define. */
  private async buildContext(document: vscode.TextDocument) {
    const documents = [document.getText().split(/\r?\n/)];
    try {
      for (const included of await openAllIncluded(document)) {
        documents.push(included.getText().split(/\r?\n/));
      }
    } catch {
      // A missing or unreadable include just means fewer known symbols.
    }
    return buildSymbolIndex(documents);
  }

  /** The findings that carry an edit, so the quick-fix provider can offer them. */
  fixesFor(uri: vscode.Uri): readonly Finding[] {
    return this.fixes.get(uri.toString()) ?? [];
  }

  // ── Configuration ───────────────────────────────────────────────────────────

  private config(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration('arm64asm.diagnostics');
  }

  private enabled(): boolean {
    return this.config().get<boolean>('enable') ?? true;
  }

  private delay(): number {
    const value = this.config().get<number>('delay') ?? DEFAULT_DELAY;
    return Number.isFinite(value) && value >= 0 ? value : DEFAULT_DELAY;
  }

  /** `undefined` means the category is turned off. */
  private severityFor(category: FindingCategory): vscode.DiagnosticSeverity | undefined {
    const raw = (this.config().get<string>(category) ?? DEFAULT_SEVERITY[category]).toLowerCase();
    switch (raw) {
      case 'error':       return vscode.DiagnosticSeverity.Error;
      case 'warning':     return vscode.DiagnosticSeverity.Warning;
      case 'information': return vscode.DiagnosticSeverity.Information;
      case 'hint':        return vscode.DiagnosticSeverity.Hint;
      case 'off':         return undefined;
      default:            return vscode.DiagnosticSeverity.Warning;
    }
  }

  // ── Status bar ──────────────────────────────────────────────────────────────

  private updateStatusBar(): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== LANGUAGE_ID) {
      this.status.hide();
      return;
    }

    const all = this.collection.get(editor.document.uri) ?? [];
    let errors = 0;
    let warnings = 0;
    for (const d of all) {
      if (d.severity === vscode.DiagnosticSeverity.Error) { errors++; }
      else if (d.severity === vscode.DiagnosticSeverity.Warning) { warnings++; }
    }

    if (errors === 0 && warnings === 0) {
      this.status.text = '$(check) ARM64';
    } else {
      this.status.text = `$(error) ${errors}  $(warning) ${warnings}`;
    }
    this.status.show();
  }
}

// ── Finding → Diagnostic ──────────────────────────────────────────────────────

function toDiagnostic(f: Finding, severity: vscode.DiagnosticSeverity): vscode.Diagnostic {
  const range = new vscode.Range(f.line, f.span.start, f.line, Math.max(f.span.end, f.span.start + 1));
  const d = new vscode.Diagnostic(range, f.message, severity);
  d.source = 'arm64asm';
  d.code = f.code;
  return d;
}
