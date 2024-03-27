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
import { Registry } from './registry/registry';

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
  const dataTree = new DataTreeView(rootPath, context);
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
  taskExitWatcher(dataTree);
  // Setup adapter commands
  setupAdapterCommands(configVals, context);

  console.log('Artificial Workflow Extension is active');
}

function taskExitWatcher(dataTree: DataTreeView) {
  vscode.tasks.onDidEndTaskProcess((e) => {
    if (e.exitCode === 0) {
      if (e.execution.task.name === 'Export Labs/Assistants') {
        dataTree.refresh();
      }
      if (e.execution.task.name === 'Setup Config') {
        const log = OutputLog.getInstance();
        log.log('Setup Config Completed');
        return;
      }
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
  const watchEnvFile = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(rootPath, '.env'));
  watchEnvFile.onDidChange((uri) => {
    outputLog.log('.env file changed');
    configVals.reset();
  });
  context.subscriptions.push(watchEnvFile);
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
  context.subscriptions.push(
    watchConfig,
    vscode.commands.registerCommand('extension.promptForAPIToken', configVals.promptForToken),
    vscode.commands.registerCommand('extension.promptForDeployTarget', configVals.promptForNewDeployTarget)
  );
  return { configVals, rootPath };
}

function setupAdapterCommands(configVals: ConfigValues, context: vscode.ExtensionContext) {
  // Update adapter image command
  context.subscriptions.push(
    vscode.commands.registerCommand('adapterActions.updateAdapterImage', async () => {
      const cancellationToken = new vscode.CancellationTokenSource();

      var adapter: ArtificialAdapterManager;
      try {
        adapter = await ArtificialAdapterManager.createRemoteAdapter(
          `labmanager.${configVals.getHost()}`,
          configVals.getPrefix(),
          configVals.getOrgId(),
          `${configVals.getLabId()}-manager`,
          configVals.getToken()
        );
      } catch (e) {
        console.log(e);
        vscode.window.showErrorMessage(`Failed to connect to labmanager.${configVals.getHost()}: ${e}`);
        return;
      }

      const adapterToUpdate = await vscode.window.showQuickPick(
        new Promise<vscode.QuickPickItem[]>((resolve, reject) => {
          adapter
            .listNonManagerAdapters()
            .then((adapters) => {
              resolve(
                adapters.map((a) => {
                  return {
                    label: a.name,
                    description: a.image,
                  };
                })
              );
            })
            .catch((e) => {
              console.log(e);
              vscode.window.showErrorMessage(`Error getting adapters to update: ${e}`);
              cancellationToken.cancel();
            });
        }),
        { placeHolder: 'Select an adapter to update' },
        cancellationToken.token
      );

      if (!adapterToUpdate) {
        return;
      }

      const r = Registry.createFromGithub(
        configVals.getGitRemoteUrl(),
        configVals.getGithubUser(),
        configVals.getGithubToken()
      );
      const image = await vscode.window.showQuickPick(
        new Promise<string[]>((resolve, reject) => {
          r.listTags()
            .then((tags) => {
              resolve(tags);
            })
            .catch((e) => {
              console.log(e);
              vscode.window.showErrorMessage(`Error getting adapter images: ${e}`);
              cancellationToken.cancel();
            });
        }),
        { placeHolder: 'Select an adapter image to update to' },
        cancellationToken.token
      );

      if (image !== undefined) {
        try {
          await adapter.updateAdapterImage(adapterToUpdate.label, image);
        } catch (e) {
          console.log(e);
          vscode.window.showErrorMessage(`Failed to update adapter image: ${e}`);
        } finally {
          vscode.window.showInformationMessage(`Updated adapter ${adapterToUpdate.label} to image ${image}`);
        }
      } else {
        vscode.window.showErrorMessage('An image is mandatory to execute this action');
      }
    })
  );

  // Execute adapter action command
  context.subscriptions.push(
    vscode.commands.registerCommand('adapterActions.executeAdapterAction', async () => {
      const action = await vscode.window.showQuickPick(
        new Promise<string[]>(async (resolve, reject) => {
          try {
            const adapter2 = await ArtificialAdapter.createRemoteAdapter(
              `labmanager.${configVals.getHost()}`,
              configVals.getPrefix(),
              configVals.getOrgId(),
              configVals.getLabId(),
              configVals.getToken()
            );
            resolve(adapter2.listActions());
          } catch (e) {
            reject(e);
          }
        }),
        { placeHolder: 'Select an action to execute' }
      );
      if (action === '') {
        console.log(action);
        vscode.window.showErrorMessage('An action is mandatory');
      }

      if (action !== undefined) {
        console.log(`Extension would execute ${action}, but that code hasn't been written yet`);
      }
    })
  );
}

export function deactivate() {}
