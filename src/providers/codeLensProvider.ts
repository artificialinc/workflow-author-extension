import * as vscode from 'vscode';

export class WorkflowPublishLensProvider implements vscode.CodeLensProvider {
  async provideCodeLenses(document: vscode.TextDocument): Promise<vscode.CodeLens[]> {
    const locations: vscode.Range[] = [];
    for (let line = 0; line < document.lineCount; line++) {
      const text = document.lineAt(line);
      if (text.text.startsWith('@workflow(')) {
        locations.push(new vscode.Range(line, 0, line, 0));
      }
    }
    let c: vscode.Command = {
      command: 'workflows.publish',
      title: 'Publish Workflow',
      arguments: [document.fileName, locations.length],
    };
    const codeLens: vscode.CodeLens[] = [];
    for (const range of locations) {
      codeLens.push(new vscode.CodeLens(range, c));
    }

    return codeLens;
  }
}
