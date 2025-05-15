import * as vscode from 'vscode';

export class GenerateStubsLensProvider implements vscode.CodeLensProvider {
  async provideCodeLenses(document: vscode.TextDocument): Promise<vscode.CodeLens[]> {
    const locations: vscode.Range[] = [];
    for (let line = 0; line < document.lineCount; line++) {
      const text = document.lineAt(line);
      const matches = text.text.match(/(\s*)@action\(/);
      if (matches) {
        locations.push(new vscode.Range(line, matches[1].length, line, matches[1].length));
      }
    }
    const codeLens: vscode.CodeLens[] = [];
    if (!locations.length) {
      return codeLens;
    }
    const c: vscode.Command = {
      command: 'adapterActions.generateActionStubs',
      title: 'Generate Stubs',
      tooltip: 'Generate stubs for all adapter actions',
    };
    for (const range of locations) {
      codeLens.push(new vscode.CodeLens(range, c));
    }

    return codeLens;
  }
}