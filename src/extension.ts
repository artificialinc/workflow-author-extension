/*
Copyright 2022 Artificial, Inc. 

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
 limitations under the License. 
*/

import * as vscode from 'vscode';
import { GenerateActionStubs } from './generators/generateActionStubs';
import { InsertFunctionCall } from './generators/generateFunctionCall';
import { DropProvider } from './providers/dropProvider';
import { PythonTreeView, Function } from './views/pythonTreeView';
import { LoadConfigTreeView } from './views/loadConfigTreeView';
import { AssistantByLabTreeView } from './views/assistantTreeView';
import { ViewFileDecorationProvider } from './providers/decorationProvider';
import { WorkflowTreeElement, WorkflowTreeView } from './views/workflowTreeView';
import { ConfigTreeView } from './views/configTreeView';
import * as dotenv from 'dotenv';

export async function activate(context: vscode.ExtensionContext) {
  const rootPath =
    vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
      ? vscode.workspace.workspaceFolders[0].uri.fsPath
      : undefined;

  if (!rootPath) {
    return;
  }
  dotenv.config({ path: rootPath + '/artificial.env' });
  let devMode = false;
  vscode.commands.registerCommand('artificial-workflows.toggleDevMode', () =>
    vscode.commands.executeCommand('setContext', 'devMode', (devMode = !devMode))
  );

  //Provides Type Error Decoration
  new ViewFileDecorationProvider();

  // Workflow Publishing view
  const workflowTree = new WorkflowTreeView(rootPath, context);
  vscode.commands.registerCommand('workflows.refreshEntry', () => workflowTree.refresh());
  vscode.commands.registerCommand('workflows.publish', (node: WorkflowTreeElement) =>
    workflowTree.publishWorkflow(node)
  );
  vscode.commands.registerCommand('workflows.generateBinary', (node: WorkflowTreeElement) =>
    workflowTree.generateWorkflow(node, false)
  );
  vscode.commands.registerCommand('workflows.generateJson', (node: WorkflowTreeElement) =>
    workflowTree.generateWorkflow(node, true)
  );

  //Function Tree and related commands
  const funcTree = new PythonTreeView(rootPath + '/workflow/stubs_actions.py', context);
  vscode.commands.registerCommand('pythonActions.refreshEntry', () => funcTree.refresh());
  const functionCallProvider = new InsertFunctionCall();
  context.subscriptions.push(
    vscode.commands.registerCommand('pythonActions.addToFile', (node: Function) =>
      functionCallProvider.insertFunction(node)
    )
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

  //Config Tree and Commands
  const configTree: ConfigTreeView = new ConfigTreeView(context);
  vscode.commands.registerCommand('configs.refreshEntry', () => configTree.refresh());

  // Generate Stubs
  const generateProvider = new GenerateActionStubs(rootPath, assistantByLab);
  context.subscriptions.push(
    vscode.commands.registerCommand('assistantsByLab.generateStubs', () => generateProvider.generateStubs())
  );

  //Drop handler for document editor
  const selector: vscode.DocumentSelector = { language: 'python' };
  context.subscriptions.push(
    vscode.languages.registerDocumentDropEditProvider(selector, new DropProvider(funcTree, assistantByLab))
  );

  console.log('Congratulations, your extension "artificial" is now active!');
}

export function deactivate() {}
