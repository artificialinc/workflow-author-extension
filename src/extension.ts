// TODO: Type imports
// TODO: Config for different filenames for actions
// TODO: Multiple modules with action support
// TODO: Support for installed pip package actions?  cellario..etc..?
// TODO: Group Assistants by Lab
// TODO: Tree for workflows to generate and publish
// TODO: Type checking and flagging for assistant stubs with no alab, or parameter misalignment
// TODO: Generate load configs out of the gql data
// TODO: Change icon based on type mismatch, tooltip?

import * as vscode from 'vscode';
import { GenerateActionStubs } from './generateActionStubs';
import { InsertFunctionCall } from './insertFunctionCall';
import { DropProvider } from './dropProvider';
import { ArtificialTreeView, Function } from './artificialTreeView';
import { LoadConfigTreeView } from './loadConfigTreeView';
import { AssistantByLabTreeView } from './assistantTreeView';

export async function activate(context: vscode.ExtensionContext) {
  const rootPath =
    vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
      ? vscode.workspace.workspaceFolders[0].uri.fsPath
      : undefined;

  if (!rootPath) {
    return;
  }
  //Function Tree and related commands
  const funcTree = new ArtificialTreeView(
    rootPath + '/workflow/stubs_actions.py',
    'artificial/python/',
    'stubs',
    context
  );
  vscode.commands.registerCommand('stubs.refreshEntry', () => funcTree.refresh());
  const functionCallProvider = new InsertFunctionCall();
  context.subscriptions.push(
    vscode.commands.registerCommand('stubs.addToFile', (node: Function) => functionCallProvider.insertFunction(node))
  );

  //Assistant Tree & Related Commands
  const assistantTree = new ArtificialTreeView(
    rootPath + '/workflow/stubs_assistants.py',
    'artificial/assistant/',
    'assistants',
    context
  );
  vscode.commands.registerCommand('assistants.refreshEntry', () => assistantTree.refresh());
  context.subscriptions.push(
    vscode.commands.registerCommand('assistants.addToFile', (node: Function) =>
      functionCallProvider.insertFunction(node)
    )
  );
  //Load Config Tree and related commands
  const loadConfigTree: LoadConfigTreeView = new LoadConfigTreeView(rootPath, 'artificial/loadConfigs/', context);
  await loadConfigTree.init();
  vscode.commands.registerCommand('loadConfigs.refreshEntry', () => loadConfigTree.refresh());

  const assistantByLab: AssistantByLabTreeView = new AssistantByLabTreeView(
    rootPath + '/workflow/stubs_assistants.py',
    'artificial/assistantByLab/',
    context
  );
  await assistantByLab.init();
  await assistantByLab.refresh();
  vscode.commands.registerCommand('assistantsByLab.refreshEntry', () => assistantByLab.refresh());

  // Generate Stubs
  const generateProvider = new GenerateActionStubs(rootPath);
  context.subscriptions.push(
    vscode.commands.registerCommand('stubs.generateStubs', () => generateProvider.generateStubs())
  );

  //Drop handler for document editor
  const selector: vscode.DocumentSelector = { language: 'python' };
  context.subscriptions.push(
    vscode.languages.registerDocumentDropEditProvider(selector, new DropProvider(funcTree, assistantTree))
  );
  console.log('Congratulations, your extension "artificial" is now active!');
}

export function deactivate() {}
