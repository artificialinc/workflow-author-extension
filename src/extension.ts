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
import { AssistantByLabTreeView } from './views/assistantTreeView';
import { ViewFileDecorationProvider } from './providers/decorationProvider';
import { WorkflowTreeView } from './views/workflowTreeView';
import { ConfigTreeView } from './views/configTreeView';
import { ConfigValues } from './providers/configProvider';
import { initConfig } from './utils';
import * as path from 'path';
import { ArtificialApollo } from './providers/apolloProvider';
import { OutputLog } from './providers/outputLogProvider';
import { WorkflowPublishLensProvider } from './providers/codeLensProvider';
import { DataTreeView } from './views/dataTreeView';

export async function activate(context: vscode.ExtensionContext) {
  const rootPath =
    vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
      ? vscode.workspace.workspaceFolders[0].uri.fsPath
      : undefined;

  if (!rootPath) {
    return;
  }
  const outputLog = OutputLog.getInstance();

  // CONFIG SETUP
  await initConfig(rootPath);
  const configVals = ConfigValues.getInstance();
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
  });
  context.subscriptions.push(watchMergedConfig);

  //Provides Type Error Decoration
  new ViewFileDecorationProvider();

  // Workflow Publishing view
  new WorkflowTreeView(rootPath, context);
  new DataTreeView(context);
  new ConfigTreeView(context);
  new InsertFunctionCall(context);

  //Function Tree and related commands
  const customAdapterActionStubPath =
    vscode.workspace.getConfiguration('artificial.workflow.author').adapterActionStubPath;

  const fullAdapterActionStubPath = path.join(rootPath, customAdapterActionStubPath);
  const funcTree = new AdapterActionTreeView(fullAdapterActionStubPath, context);
  funcTree.init();

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

  new GenerateAssistantStubs(context, rootPath, assistantByLab);

  //Drop handler for document editor
  const selector: vscode.DocumentSelector = { language: 'python' };
  context.subscriptions.push(
    vscode.languages.registerDocumentDropEditProvider(selector, new DropProvider(context, funcTree, assistantByLab))
  );

  // Status Bar for Connection Info
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
  const host = configVals.getHost().split('.')[0];
  statusBar.text = `$(debug-disconnect) ` + host;
  statusBar.tooltip = `Artificial Workflow extension connected to ${configVals.getHost()}`;
  statusBar.show();
  context.subscriptions.push(statusBar);

  //Code Lens for WF Publish
  let codeLensProviderDisposable = vscode.languages.registerCodeLensProvider(
    selector,
    new WorkflowPublishLensProvider()
  );
  context.subscriptions.push(codeLensProviderDisposable);

  console.log('Artificial Workflow Extension is active');
}

export function deactivate() {}
