/**
 * Offers the edits the rules attached to their findings — Ctrl+. on a squiggle.
 *
 * The fixes come from the analysis itself, not from re-deriving anything here:
 * a rule that knows how to spot the mistake is the rule that knows how to
 * repair it.
 */

import * as vscode from 'vscode';
import type { Arm64DiagnosticManager } from './manager';

export class Arm64QuickFixProvider implements vscode.CodeActionProvider {
  static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];

  constructor(private readonly manager: Arm64DiagnosticManager) {}

  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext
  ): vscode.CodeAction[] {
    const ours = context.diagnostics.filter(d => d.source === 'arm64asm');
    if (ours.length === 0) { return []; }

    const actions: vscode.CodeAction[] = [];

    for (const finding of this.manager.fixesFor(document.uri)) {
      const fix = finding.fix;
      if (!fix) { continue; }

      const findingRange = new vscode.Range(
        finding.line, finding.span.start,
        finding.line, Math.max(finding.span.end, finding.span.start + 1)
      );

      // Only offer a fix for a diagnostic the editor is actually showing here.
      const diagnostic = ours.find(d => d.code === finding.code && d.range.isEqual(findingRange));
      if (!diagnostic) { continue; }
      if (!findingRange.intersection(range) && !findingRange.contains(range.start)) { continue; }

      const target = fix.span ?? finding.span;
      const action = new vscode.CodeAction(fix.title, vscode.CodeActionKind.QuickFix);
      action.diagnostics = [diagnostic];
      action.edit = new vscode.WorkspaceEdit();
      action.edit.replace(
        document.uri,
        new vscode.Range(finding.line, target.start, finding.line, target.end),
        fix.newText
      );
      actions.push(action);
    }

    return actions;
  }
}
