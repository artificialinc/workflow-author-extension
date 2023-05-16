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
import { GenerateAssistantStubs } from './generators/generateAssistantStubs';
import { InsertFunctionCall } from './generators/generateFunctionCall';
import { DropProvider } from './providers/dropProvider';
import { AdapterActionTreeView, Function } from './views/adapterActionTreeView';
import { LoadConfigTreeView } from './views/loadConfigTreeView';
import { AssistantByLabTreeView } from './views/assistantTreeView';
import { ViewFileDecorationProvider } from './providers/decorationProvider';
import { WorkflowTreeElement, WorkflowTreeView } from './views/workflowTreeView';
import { ConfigTreeView } from './views/configTreeView';
import { ConfigValues } from './providers/configProvider';
import { initConfig } from './utils';
import * as path from 'path';
import { GenerateAdapterActionStubs } from './generators/generateAdapterActionStubs';
import { ArtificialApollo } from './providers/apolloProvider';
import { OutputLog } from './providers/outputLogProvider';
import { WorkflowPublishLensProvider } from './providers/codeLensProvider';

export async function activate(context: vscode.ExtensionContext) {
  const rootPath =
    vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
      ? vscode.workspace.workspaceFolders[0].uri.fsPath
      : undefined;

  if (!rootPath) {
    return;
  }
  await initConfig(rootPath);
  let devMode = false;
  const configVals = ConfigValues.getInstance();

  const outputLog = OutputLog.getInstance();

  const watchConfig = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(rootPath + '/configs', '**/*.yaml')
  );

  watchConfig.onDidChange((uri) => {
    initConfig(rootPath);
  });
  context.subscriptions.push(watchConfig);

  const watchMergedConfig = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(rootPath + '/tmp', 'merged.yaml')
  );
  watchMergedConfig.onDidChange((uri) => {
    outputLog.log('merged.yaml changed');
    configVals.reset();
    const client = ArtificialApollo.getInstance();
    client.reset();
    statusBar.text = `$(debug-disconnect) ` + configVals.getHost().split('.')[0];
    statusBar.tooltip = `Artificial Workflow extension connected to ${configVals.getHost()}`;
    assistantByLab.refresh();
    loadConfigTree.refresh();
  });
  context.subscriptions.push(watchMergedConfig);

  vscode.commands.registerCommand('artificial-workflows.toggleDevMode', () =>
    vscode.commands.executeCommand('setContext', 'devMode', (devMode = !devMode))
  );

  //Provides Type Error Decoration
  new ViewFileDecorationProvider();

  // Workflow Publishing view
  const workflowTree = new WorkflowTreeView(rootPath, context);
  vscode.commands.registerCommand('workflows.refreshEntry', () => workflowTree.refresh());
  vscode.commands.registerCommand('workflows.publish', (path: string, workflowIDs: string[]) =>
    workflowTree.publishWorkflow(path, workflowIDs)
  );
  vscode.commands.registerCommand('workflows.treePublish', (node: WorkflowTreeElement) =>
    workflowTree.publishWorkflow(node.path, node.workflowIds)
  );
  vscode.commands.registerCommand('workflows.generateBinary', (node: WorkflowTreeElement) =>
    workflowTree.generateWorkflow(node.path, false)
  );
  vscode.commands.registerCommand('workflows.generateJson', (node: WorkflowTreeElement) =>
    workflowTree.generateWorkflow(node.path, true)
  );

  //Function Tree and related commands
  const customAdapterActionStubPath =
    vscode.workspace.getConfiguration('artificial.workflow.author').adapterActionStubPath;

  const fullAdapterActionStubPath = path.join(rootPath, customAdapterActionStubPath);
  const funcTree = new AdapterActionTreeView(fullAdapterActionStubPath, context);
  funcTree.init();
  vscode.commands.registerCommand('adapterActions.refreshEntry', () => funcTree.refresh());
  const functionCallProvider = new InsertFunctionCall();
  context.subscriptions.push(
    vscode.commands.registerCommand('adapterActions.addToFile', (node: Function) =>
      functionCallProvider.insertFunction(node)
    )
  );

  //Load Config Tree and related commands
  const loadConfigTree: LoadConfigTreeView = new LoadConfigTreeView(rootPath, context);
  await loadConfigTree.init();
  vscode.commands.registerCommand('loadConfigs.refreshEntry', () => loadConfigTree.refresh());

  const customAssistantStubPath = vscode.workspace.getConfiguration('artificial.workflow.author').assistantStubPath;
  const fullAssistantStubPath = path.join(rootPath, customAssistantStubPath);
  //Assistant Tree and Commands
  const assistantByLab: AssistantByLabTreeView = new AssistantByLabTreeView(
    fullAssistantStubPath,
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
  const generateAssistantsProvider = new GenerateAssistantStubs(rootPath, assistantByLab);
  context.subscriptions.push(
    vscode.commands.registerCommand('assistantsByLab.generateAssistantStubs', () =>
      generateAssistantsProvider.generateAssistantStubsCommand()
    )
  );

  // const generateAdapterActionsProvider = new GenerateAdapterActionStubs(rootPath, funcTree);
  // context.subscriptions.push(
  //   vscode.commands.registerCommand('adapterActions.generateAdapterStubs', () =>
  //     generateAdapterActionsProvider.generateAdapterActionStubsCommand()
  //   )
  // );

  //Drop handler for document editor
  const selector: vscode.DocumentSelector = { language: 'python' };
  context.subscriptions.push(
    vscode.languages.registerDocumentDropEditProvider(selector, new DropProvider(funcTree, assistantByLab))
  );

  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);

  const host = configVals.getHost().split('.')[0];
  statusBar.text = `$(debug-disconnect) ` + host;
  statusBar.tooltip = `Artificial Workflow extension connected to ${configVals.getHost()}`;
  statusBar.show();
  context.subscriptions.push(statusBar);

  let docSelector = {
    language: 'python',
    scheme: 'file',
  };

  let codeLensProviderDisposable = vscode.languages.registerCodeLensProvider(
    docSelector,
    new WorkflowPublishLensProvider()
  );

  context.subscriptions.push(codeLensProviderDisposable);

  console.log('Artificial Workflow Extension is active');
}

export function deactivate() {}
