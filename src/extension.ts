// TODO: Icons
// TODO: Type imports
// TODO: Config for different filenames for actions
// TODO: Multiple modules with action support
// TODO: Switch to parsing generated stubs
// TODO: Use parsed stubs to create teh dropped function call signatures

import * as vscode from 'vscode';
import { AssistantTreeView } from './assistantTreeView';
import { FunctionTreeView, AdapterFunction } from './functionTreeView';
import { GenerateActionStubs } from './generateActionStubs';
import { InsertFunctionCall } from './insertFunctionCall';
import { DropProvider } from './dropProvider';

export function activate(context: vscode.ExtensionContext) {
  const rootPath =
    vscode.workspace.workspaceFolders &&
    vscode.workspace.workspaceFolders.length > 0
      ? vscode.workspace.workspaceFolders[0].uri.fsPath
      : undefined;

  if (!rootPath) {
    return;
  }
  const funcTree = new FunctionTreeView(rootPath, context);
  const assistantTree = new AssistantTreeView(context);
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
  const selector: vscode.DocumentSelector = { language: 'python' };
  context.subscriptions.push(
    vscode.languages.registerDocumentDropEditProvider(
      selector,
      new DropProvider(funcTree, assistantTree)
    )
  );
  console.log('Congratulations, your extension "artificial" is now active!');
}

export function deactivate() {}
