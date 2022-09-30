// TODO: Type imports
// TODO: Config for different filenames for actions
// TODO: Multiple modules with action support
// TODO: Support for installed pip package actions?  cellario..etc..?
// TODO: Tree for workflows to generate and publish
// TODO: Generate load configs out of the gql data

import * as vscode from 'vscode';
import { GenerateActionStubs } from './generators/generateActionStubs';
import { InsertFunctionCall } from './generators/generateFunctionCall';
import { DropProvider } from './providers/dropProvider';
import { PythonTreeView, Function } from './treeViews/pythonTreeView';
import { LoadConfigTreeView } from './treeViews/loadConfigTreeView';
import { AssistantByLabTreeView } from './treeViews/assistantTreeView';
import { ViewFileDecorationProvider } from './decorationProvider';
import { WorkflowTreeView } from './treeViews/workflowTreeView';

export async function activate(context: vscode.ExtensionContext) {
  const rootPath =
    vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
      ? vscode.workspace.workspaceFolders[0].uri.fsPath
      : undefined;

  if (!rootPath) {
    return;
  }

  //Provides Type Error Decoration
  new ViewFileDecorationProvider();

  const workflowTree = new WorkflowTreeView(rootPath, context);

  //Function Tree and related commands
  const funcTree = new PythonTreeView(rootPath + '/workflow/stubs_actions.py', context);
  vscode.commands.registerCommand('stubs.refreshEntry', () => funcTree.refresh());
  const functionCallProvider = new InsertFunctionCall();
  context.subscriptions.push(
    vscode.commands.registerCommand('stubs.addToFile', (node: Function) => functionCallProvider.insertFunction(node))
  );

  //Load Config Tree and related commands
  const loadConfigTree: LoadConfigTreeView = new LoadConfigTreeView(rootPath, context);
  await loadConfigTree.init();
  vscode.commands.registerCommand('loadConfigs.refreshEntry', () => loadConfigTree.refresh());

  //Assistant Tree and Commands
  const assistantByLab: AssistantByLabTreeView = new AssistantByLabTreeView(
    rootPath + '/workflow/stubs_assistants.py',
    'artificial/assistantByLab/',
    context
  );
  await assistantByLab.init();
  await assistantByLab.refresh();
  vscode.commands.registerCommand('assistantsByLab.refreshEntry', () => assistantByLab.refresh());
  context.subscriptions.push(
    vscode.commands.registerCommand('assistantsByLab.addToFile', (node: Function) =>
      functionCallProvider.insertFunction(node)
    )
  );

  // Generate Stubs
  const generateProvider = new GenerateActionStubs(rootPath);
  context.subscriptions.push(
    vscode.commands.registerCommand('stubs.generateStubs', () => generateProvider.generateStubs())
  );

  //Drop handler for document editor
  const selector: vscode.DocumentSelector = { language: 'python' };
  context.subscriptions.push(
    vscode.languages.registerDocumentDropEditProvider(selector, new DropProvider(funcTree, assistantByLab))
  );

  console.log('Congratulations, your extension "artificial" is now active!');
}

export function deactivate() {}

// let terminal = vscode.window.activeTerminal;
// if (!terminal) {
//   terminal = vscode.window.createTerminal(`Ext Terminal`);
// }
// terminal.sendText('cd workflow');
// terminal.sendText('ls');
