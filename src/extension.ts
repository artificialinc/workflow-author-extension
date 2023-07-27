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
import { ArtificialApollo } from './providers/apolloProvider';
import { OutputLog } from './providers/outputLogProvider';
import { WorkflowPublishLensProvider } from './providers/codeLensProvider';
import { DataTreeView } from './views/dataTreeView';
import { ArtificialAdapter, ArtificialAdapterManager } from './adapter/adapter';

export async function activate(context: vscode.ExtensionContext) {
  // Config Setup
  const { configVals, rootPath } = await setupConfig(context);
  if (!rootPath) {
    return;
  }

  //Provides Type Error Decoration
  new ViewFileDecorationProvider();
  // Workflow Publishing Tree
  new WorkflowTreeView(rootPath, context);
  // Import/Export Buttons
  new DataTreeView(rootPath, context);
  // Config Tree
  new ConfigTreeView(context);
  // Commands to insert & drag/drop functions
  setupDragAndDrop(context);
  // Adapter Function Tree
  const funcTree = setupAdapterFuncTree(configVals, context);
  // Assistant Tree
  const assistantByLab = await setupAssistantTree(configVals, context);
  // Command to generate assistant stubs
  new GenerateAssistantStubs(context, rootPath, assistantByLab);
  //Drop handler for document editor
  const selector = setupDropHandler(context, funcTree, assistantByLab);
  // Status Bar for Connection Info
  const statusBar = setupStatusBar(configVals, context);
  // Code Lens for WF Publish
  setupCodeLens(selector, context);
  // Handle config resets across components
  configResetWatcher(rootPath, configVals, statusBar, assistantByLab, context);
  // Handle terminal command exit code notifications
  taskExitWatcher();

  // Setup adapter commands
  setupAdapterCommands(configVals, context);

  console.log('Artificial Workflow Extension is active');
}

function taskExitWatcher() {
  vscode.tasks.onDidEndTaskProcess((e) => {
    if (e.exitCode === 0) {
      vscode.window.showInformationMessage(`${e.execution.task.name} completed successfully`);
    } else {
      vscode.window.showErrorMessage(`${e.execution.task.name}: Please check terminal logs for error details`);
    }
  });
}

async function setupAssistantTree(configVals: ConfigValues, context: vscode.ExtensionContext) {
  const assistantByLab = new AssistantByLabTreeView(
    configVals.getAssistantStubPath(),
    'artificial/assistantByLab/',
    context
  );
  await assistantByLab.init();
  return assistantByLab;
}

function setupAdapterFuncTree(configVals: ConfigValues, context: vscode.ExtensionContext) {
  const funcTree = new AdapterActionTreeView(configVals.getAdapterActionStubPath(), context);
  funcTree.init();
  return funcTree;
}

function setupDragAndDrop(context: vscode.ExtensionContext) {
  const funcCall = new InsertFunctionCall();
  context.subscriptions.push(
    vscode.commands.registerCommand('adapterActions.addToFile', (node: Function) => funcCall.insertFunction(node)),
    vscode.commands.registerCommand('assistantsByLab.addToFile', (node: Function) => funcCall.insertFunction(node))
  );
}

function setupDropHandler(
  context: vscode.ExtensionContext,
  funcTree: AdapterActionTreeView,
  assistantByLab: AssistantByLabTreeView
) {
  const selector: vscode.DocumentFilter = { language: 'python', scheme: 'file' };
  context.subscriptions.push(
    vscode.languages.registerDocumentDropEditProvider(selector, new DropProvider(context, funcTree, assistantByLab))
  );
  return selector;
}

function setupCodeLens(selector: vscode.DocumentFilter, context: vscode.ExtensionContext) {
  const codeLensProviderDisposable = vscode.languages.registerCodeLensProvider(
    selector,
    new WorkflowPublishLensProvider()
  );
  context.subscriptions.push(codeLensProviderDisposable);
}

function setupStatusBar(configVals: ConfigValues, context: vscode.ExtensionContext) {
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
  const host = configVals.getHost().split('.')[0];
  statusBar.text = `$(debug-disconnect) ` + host;
  statusBar.tooltip = `Artificial Workflow extension connected to ${configVals.getHost()}`;
  statusBar.show();
  context.subscriptions.push(statusBar);
  return statusBar;
}

function configResetWatcher(
  rootPath: string,
  configVals: ConfigValues,
  statusBar: vscode.StatusBarItem,
  assistantByLab: AssistantByLabTreeView,
  context: vscode.ExtensionContext
) {
  const watchMergedConfig = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(rootPath + '/tmp', 'merged.yaml')
  );
  const outputLog = OutputLog.getInstance();
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
}

async function setupConfig(context: vscode.ExtensionContext) {
  const rootPath =
    vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
      ? vscode.workspace.workspaceFolders[0].uri.fsPath
      : '';
  await initConfig(rootPath);
  const configVals = ConfigValues.getInstance();
  const watchConfig = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(rootPath + '/configs', '**/*.yaml')
  );
  watchConfig.onDidChange((uri) => {
    initConfig(rootPath);
  });
  context.subscriptions.push(watchConfig);
  return { configVals, rootPath };
}

function setupAdapterCommands(configVals: ConfigValues, context: vscode.ExtensionContext) {
  // Update adapter image command
  context.subscriptions.push(
    vscode.commands.registerCommand('adapterActions.updateAdapterImage', async () => {
      const adapter = await ArtificialAdapterManager.createLocalAdapter();
      const image = await vscode.window.showQuickPick(new Promise<string[]>((resolve, reject) => {
        resolve([
          "ghcr.io/artificialinc/adapter-manager:aidan-5",
          "ghcr.io/artificialinc/adapter-manager:aidan-6",
          "ghcr.io/artificialinc/adapter-manager:shawn-7",]);
      }), { placeHolder: 'Select an adapter image to update to' });
      if (image === '') {
        console.log(image);
        vscode.window.showErrorMessage('An image is mandatory to execute this action');
      }

      if (image !== undefined) {
        console.log(image);
        await adapter.updateAdapterImage("adapter_manager", image);
      }
    }
    )
  );

  // Execute adapter action command
  context.subscriptions.push(
    vscode.commands.registerCommand('adapterActions.executeAdapterAction', async () => {
      const action = await vscode.window.showQuickPick(new Promise<string[]>(async (resolve, reject) => {
        try {
          const adapter2 = await ArtificialAdapter.createRemoteAdapter(
            `labmanager.${configVals.getHost()}`,
            configVals.getPrefix(),
            configVals.getOrgId(),
            configVals.getLabId(),
            configVals.getToken(),
          );
          resolve(adapter2.listActions());
        } catch (e) {
          reject(e);
        }
      }), { placeHolder: "Select an action to execute" });
      if (action === '') {
        console.log(action);
        vscode.window.showErrorMessage('An action is mandatory');
      }

      if (action !== undefined) {
        console.log(`Extension would execute ${action}, but that code hasn't been written yet`);
      }
    }
    )
  );
}


export function deactivate() { }
