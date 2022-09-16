// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { FunctionTreeView } from './functionTreeView';
import { GenerateActionStubs } from './generateActionStubs';
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  const rootPath =
    vscode.workspace.workspaceFolders &&
    vscode.workspace.workspaceFolders.length > 0
      ? vscode.workspace.workspaceFolders[0].uri.fsPath
      : undefined;

  if (!rootPath) {
    return;
  }
  const stubsProvider = new FunctionTreeView(rootPath);
  const generateProvider = new GenerateActionStubs(rootPath);
  vscode.window.registerTreeDataProvider('stubs', stubsProvider);
  context.subscriptions.push(
    vscode.commands.registerCommand('stubs.refreshEntry', () =>
      stubsProvider.refresh()
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('stubs.generateStubs', () =>
      generateProvider.generateStubs()
    )
  );
  console.log('Congratulations, your extension "artificial" is now active!');
}

// this method is called when your extension is deactivated
export function deactivate() {}
