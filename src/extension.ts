// TODO: Parenthesis inside parameters is bug for beam
// TODO: Hack shove function call inside uri for drag and drop?
// TODO: Config for different filenames for actions
// TODO: Multiple modules with action support
import * as vscode from 'vscode';
import { FunctionTreeView, AdapterFunction } from './functionTreeView';
import { GenerateActionStubs } from './generateActionStubs';
import { InsertFunctionCall } from './insertFunctionCall';

export function activate(context: vscode.ExtensionContext) {
  const rootPath =
    vscode.workspace.workspaceFolders &&
    vscode.workspace.workspaceFolders.length > 0
      ? vscode.workspace.workspaceFolders[0].uri.fsPath
      : undefined;

  if (!rootPath) {
    return;
  }
  new FunctionTreeView(rootPath, context);
  const generateProvider = new GenerateActionStubs(rootPath);
  context.subscriptions.push(
    vscode.commands.registerCommand('stubs.generateStubs', () =>
      generateProvider.generateStubs()
    )
  );

  const functionCallProvider = new InsertFunctionCall();
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'stubs.addToFile',
      (node: AdapterFunction) => functionCallProvider.insertFunction(node)
    )
  );
  console.log('Congratulations, your extension "artificial" is now active!');
}

export function deactivate() {}
