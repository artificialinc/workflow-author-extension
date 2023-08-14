import * as vscode from 'vscode';
import { findWorkflowsInFiles } from '../utils';

export class WorkflowPublishLensProvider implements vscode.CodeLensProvider {
  async provideCodeLenses(document: vscode.TextDocument): Promise<vscode.CodeLens[]> {
    const locations: vscode.Range[] = [];
    let workflows: { path: string; ids: string[] }[] = [];
    for (let line = 0; line < document.lineCount; line++) {
      const text = document.lineAt(line);
      if (text.text.startsWith('@workflow(')) {
        workflows = findWorkflowsInFiles([document.fileName]);
        locations.push(new vscode.Range(line, 0, line, 0));
      }
    }
    const codeLens: vscode.CodeLens[] = [];
    if (!workflows.length) {
      return codeLens;
    }
    let c: vscode.Command = {
      command: 'workflows.publish',
      title: 'Publish Workflow',
      arguments: [document.fileName, workflows[0].ids],
    };
    for (const range of locations) {
      codeLens.push(new vscode.CodeLens(range, c));
    }

    return codeLens;
  }
}
