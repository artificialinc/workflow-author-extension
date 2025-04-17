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
import { AdapterActionTreeView, ArtificialFunction } from './views/adapterActionTreeView';
import { AssistantByLabTreeView } from './views/assistantTreeView';
import { ViewFileDecorationProvider } from './providers/decorationProvider';
import { WorkflowTreeView } from './views/workflowTreeView';
import { ConfigTreeView } from './views/configTreeView';
import { LoadingConfigByLabTreeView } from './views/loadingConfigView';
import { ConfigValues } from './providers/configProvider';
import { generateActionStubs, initConfig } from './utils';
import { ArtificialApollo } from './providers/apolloProvider';
import { OutputLog } from './providers/outputLogProvider';
import { WorkflowPublishLensProvider } from './providers/codeLensProvider';
import { StandAloneActionCodeLensProvider } from './providers/standaloneActionCodeLensProvider';
import { DataTreeView } from './views/dataTreeView';
import { AdapterInfo, ArtificialAdapter, ArtificialAdapterManager } from './adapter/adapter';
import { Registry } from './registry/registry';
import { authExternalUriRegistration } from './auth/auth';
import { addFileToContext, artificialTask, artificialAwaitTask } from './utils';
import * as path from 'path';
import * as fs from 'fs';

export async function activate(context: vscode.ExtensionContext) {
  // Setup authentication URI handler before config so it can be used to fill out config
  authExternalUriRegistration(context);

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
  // Loading Config Tree
  const loadconfigs = new LoadingConfigByLabTreeView(context);
  loadconfigs.init();
  // Commands to insert & drag/drop functions
  setupDragAndDrop(context);
  // Adapter Function Tree
  const funcTree = setupAdapterFuncTree(context);
  // Assistant Tree
  const assistantByLab = await setupAssistantTree(configVals, context);
  // Command to generate assistant stubs
  new GenerateAssistantStubs(context, rootPath, assistantByLab);
  //Drop handler for document editor
  const selector = setupDropHandler(context, funcTree, assistantByLab, loadconfigs);
  // Status Bar for Connection Info
  const statusBar = await setupStatusBar(configVals, context);
  // Code Lens for WF Publish
  setupCodeLens(selector, context);
  // Handle config resets across components
  configResetWatcher(rootPath, configVals, statusBar, assistantByLab, context);
  // Handle terminal command exit code notifications
  taskExitWatcher(dataTree);
  // Setup adapter commands
  setupAdapterCommands(configVals, context, funcTree);
  setupPickLabCommand(configVals, context);
  console.log('Artificial Workflow Extension is active');
}

async function publishStandaloneAction(action: string): Promise<void> {
  const rootPath =
    vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
      ? vscode.workspace.workspaceFolders[0].uri.fsPath
      : undefined;
  const outputLog = OutputLog.getInstance();
  const generateTaskName = 'Generate Action: ' + action;
  const publishTaskName = 'Publish Action: ';
  const pythonInterpreter = await ConfigValues.getPythonInterpreter();
  const stubPath = await ConfigValues.getInstance().getAdapterActionStubPath();
  const labId = await ConfigValues.getInstance().getLabId();

  try {
    await artificialAwaitTask(
      generateTaskName,
      `(cd ${rootPath}/workflow; ${pythonInterpreter}/wfgen ${stubPath} -s ${action} -l ${labId})`,
    );
  } catch {
    outputLog.log('Generate Failed, Skipping Publish');
    return;
  }

  await artificialTask(
    publishTaskName,
    `(${pythonInterpreter}/wf publish ${path.dirname(stubPath)}/${action + '.bin'})`,
  );
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
      // If we are just checking the version of the CLI, don't show a notification on success
      if (e.execution.task.name === 'Check artificial-workflows-tools Version') {
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
    context,
  );
  await assistantByLab.init();
  return assistantByLab;
}

function setupAdapterFuncTree(context: vscode.ExtensionContext) {
  const funcTree = new AdapterActionTreeView(context);
  funcTree.init();
  return funcTree;
}

function setupDragAndDrop(context: vscode.ExtensionContext) {
  const funcCall = new InsertFunctionCall();
  context.subscriptions.push(
    vscode.commands.registerCommand('adapterActions.addToFile', (node: ArtificialFunction) =>
      funcCall.insertFunction(node),
    ),
    vscode.commands.registerCommand('assistantsByLab.addToFile', (node: ArtificialFunction) =>
      funcCall.insertFunction(node),
    ),
  );
}

function setupDropHandler(
  context: vscode.ExtensionContext,
  funcTree: AdapterActionTreeView,
  assistantByLab: AssistantByLabTreeView,
  loadConfigs: LoadingConfigByLabTreeView,
) {
  const selector: vscode.DocumentFilter = { language: 'python', scheme: 'file' };
  context.subscriptions.push(
    vscode.languages.registerDocumentDropEditProvider(
      selector,
      new DropProvider(context, funcTree, assistantByLab, loadConfigs),
    ),
  );
  return selector;
}

function setupCodeLens(selector: vscode.DocumentFilter, context: vscode.ExtensionContext) {
  const codeLensProviderDisposable = vscode.languages.registerCodeLensProvider(
    selector,
    new WorkflowPublishLensProvider(),
  );
  context.subscriptions.push(codeLensProviderDisposable);
  const standaloneCodeLensProviderDisposable = vscode.languages.registerCodeLensProvider(
    selector,
    new StandAloneActionCodeLensProvider(),
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('workflows.standalonePublish', (action: string) => publishStandaloneAction(action)),
  );
  context.subscriptions.push(standaloneCodeLensProviderDisposable);
}

async function setupStatusBar(configVals: ConfigValues, context: vscode.ExtensionContext) {
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
  const host = configVals.getHost().split('.')[0];
  const labName = await configVals.getLabName();
  statusBar.text = `$(debug-disconnect) ${labName} @ ${host}`;
  statusBar.tooltip = `Artificial Workflow extension connected to ${configVals.getHost()}`;
  statusBar.command = 'adapterActions.signin';
  statusBar.show();
  context.subscriptions.push(statusBar);
  return statusBar;
}

function configResetWatcher(
  rootPath: string,
  configVals: ConfigValues,
  statusBar: vscode.StatusBarItem,
  assistantByLab: AssistantByLabTreeView,
  context: vscode.ExtensionContext,
) {
  const watchMergedConfig = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(rootPath + '/tmp', 'merged.yaml'),
  );
  const outputLog = OutputLog.getInstance();
  watchMergedConfig.onDidChange(() => {
    outputLog.log('merged.yaml changed');
    (async () => {
      await configVals.reset();
      const client = ArtificialApollo.getInstance();
      client.reset();
      statusBar.text = `$(debug-disconnect) ${await configVals.getLabName()} @ ${configVals.getHost().split('.')[0]}`;
      statusBar.tooltip = `Artificial Workflow extension connected to ${configVals.getHost()}`;
      statusBar.show();
      assistantByLab.refresh();
    })();
  });
  context.subscriptions.push(watchMergedConfig);
  const watchEnvFile = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(rootPath, '.env'));
  watchEnvFile.onDidChange(() => {
    outputLog.log('.env file changed');
    (async () => {
      await configVals.reset();
    })();
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
    new vscode.RelativePattern(rootPath + '/configs', '**/*.yaml'),
  );
  watchConfig.onDidChange(async () => {
    await initConfig(rootPath);
  });
  watchConfig.onDidCreate(async () => {
    await initConfig(rootPath);
  });
  watchConfig.onDidDelete(async () => {
    await initConfig(rootPath);
  });
  context.subscriptions.push(watchConfig);
  return { configVals, rootPath };
}

function setupPickLabCommand(configVals: ConfigValues, context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand('configActions.updateLab', async () => {
      const client = ArtificialApollo.getInstance();
      const response = await client.queryLabs();
      if (!response) {
        return;
      }
      const options = response.labs.map((lab) => {
        return {
          label: lab.name,
          description: lab.id,
        };
      });
      const lab = await vscode.window.showQuickPick(options, { placeHolder: 'Select a lab' });
      const generatedObj = {
        artificial: {
          host: configVals.getHost(),
          token: configVals.getToken(),
          lab: lab?.description,
        },
      };

      addFileToContext(JSON.stringify(generatedObj), 'generated.yaml');
    }),
  );
}

async function pickAdapter(
  configVals: ConfigValues,
  cancellationToken: vscode.CancellationTokenSource,
  prompt: string,
  managedOnly = true,
): Promise<[AdapterInfo, ArtificialAdapterManager] | undefined> {
  const resp = await _pickAdapter(configVals, cancellationToken, prompt, managedOnly, false);
  if (!resp) {
    return;
  }
  const [adapters, adapterManager] = resp;
  if (adapters.length === 0) {
    vscode.window.showErrorMessage('No adapters found');
    return;
  }
  return [adapters[0], adapterManager];
}

async function pickAdapters(
  configVals: ConfigValues,
  cancellationToken: vscode.CancellationTokenSource,
  prompt: string,
  managedOnly = true,
  allowAll = false,
): Promise<[AdapterInfo[], ArtificialAdapterManager] | undefined> {
  const resp = await _pickAdapter(configVals, cancellationToken, prompt, managedOnly, allowAll);
  if (!resp) {
    return;
  }
  const [adapters, adapterManager] = resp;
  if (adapters.length === 0) {
    vscode.window.showErrorMessage('No adapters found');
    return;
  }
  return [adapters, adapterManager];
}

async function _pickAdapter(
  configVals: ConfigValues,
  cancellationToken: vscode.CancellationTokenSource,
  prompt: string,
  managedOnly = true,
  allowAll = false,
): Promise<[AdapterInfo[], ArtificialAdapterManager] | undefined> {
  let adapterManager: ArtificialAdapterManager;
  try {
    adapterManager = await ArtificialAdapterManager.createAdapterManager(
      configVals.getHost(),
      configVals.getPrefix(),
      configVals.getOrgId(),
      `${configVals.getLabId()}`,
      configVals.getToken(),
    );
  } catch (e) {
    console.log(e);
    vscode.window.showErrorMessage(`Failed to connect to labmanager.${configVals.getHost()}: ${e}`);
    return;
  }

  let adapters: AdapterInfo[] = [];
  try {
    adapters = await adapterManager.listNonManagerAdapters(managedOnly);
  } catch (e) {
    console.log(e);
    vscode.window.showErrorMessage(`Error getting adapters: ${e}`);
    cancellationToken.cancel();
  }

  const adapterOptions: vscode.QuickPickItem[] = adapters.map((a) => {
    return {
      label: `${a.name}`,
      description: a.image || 'No image',
    };
  });

  if (allowAll) {
    adapterOptions.push({ label: 'All', description: 'Select all adapters' });
  }

  const adapter = await vscode.window.showQuickPick(
    new Promise<vscode.QuickPickItem[]>((resolve) => {
      resolve(adapterOptions);
    }),
    { placeHolder: prompt },
    cancellationToken.token,
  );

  if (adapter === undefined) {
    return;
  }

  if (adapter.label === 'All') {
    const allAdapters = await adapterManager.listNonManagerAdapters(false);
    return [allAdapters, adapterManager];
  }

  // Get adapter from the selected label
  const a = adapters.find((a) => a.name === adapter.label);
  if (a === undefined) {
    vscode.window.showErrorMessage('Failed to find adapter');
    return;
  }

  return [[a], adapterManager];
}

function setupAdapterCommands(
  configVals: ConfigValues,
  context: vscode.ExtensionContext,
  funcTree: AdapterActionTreeView,
) {
  // Update adapter image command
  context.subscriptions.push(
    vscode.commands.registerCommand('adapterActions.updateAdapterImage', async () => {
      const cancellationToken = new vscode.CancellationTokenSource();

      const resp = await pickAdapter(configVals, cancellationToken, 'Select an adapter to update');
      if (!resp) {
        return;
      }

      const [adapterToUpdate, adapterManager] = resp;

      if (!adapterToUpdate) {
        return;
      }

      const r = Registry.createFromGithub(
        configVals.getGitRemoteUrl(),
        configVals.getGithubUser(),
        configVals.getGithubToken(),
      );
      const image = await vscode.window.showQuickPick(
        new Promise<string[]>((resolve) => {
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
        cancellationToken.token,
      );

      if (image !== undefined) {
        // Get adapter from the selected label
        try {
          await adapterManager.updateAdapterImage(adapterToUpdate.name, image, adapterToUpdate.labId);
        } catch (e) {
          console.log(e);
          vscode.window.showErrorMessage(`Failed to update adapter image: ${e}`);
          return;
        }
        vscode.window.showInformationMessage(`Updated adapter ${adapterToUpdate.name} to image ${image}`);
        return;
      } else {
        vscode.window.showErrorMessage('An image is mandatory to execute this action');
      }
    }),
  );

  // Execute adapter action command
  context.subscriptions.push(
    vscode.commands.registerCommand('adapterActions.executeAdapterAction', async () => {
      const cancellationToken = new vscode.CancellationTokenSource();

      const resp = await pickAdapter(configVals, cancellationToken, 'Select an adapter to get sigpak', false);
      if (!resp) {
        return;
      }

      const [adapter, _] = resp;

      const adapterClient = await ArtificialAdapter.createRemoteAdapter(
        configVals.getHost(),
        configVals.getLabId(),
        configVals.getToken(),
        adapter.scope,
      );

      const action = await vscode.window.showQuickPick(
        new Promise<string[]>((resolve, reject) => {
          try {
            resolve(adapterClient.listActions());
          } catch (e) {
            reject(e);
          }
        }),
        { placeHolder: 'Select an action to execute' },
      );

      if (action === '') {
        console.log(action);
        vscode.window.showErrorMessage('An action is mandatory');
      }

      if (action !== undefined) {
        console.log(`Extension would execute ${action}, but that code hasn't been written yet`);
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('adapterActions.remoteSigGeneration', async () => {
      const cancellationToken = new vscode.CancellationTokenSource();

      const resp = await pickAdapters(configVals, cancellationToken, 'Select an adapter to get sigpak', false, true);
      if (!resp) {
        return;
      }

      const [adapters, _] = resp;

      const sigpakPaths: string[] = [];
      for (const adapter of adapters) {
        if (adapter.banned) {
          // Skip banned adapters but log
          OutputLog.getInstance().log(`Skipping banned adapter ${adapter.name}`);
          continue;
        }

        const adapterClient = await ArtificialAdapter.createRemoteAdapter(
          configVals.getHost(),
          configVals.getLabId(),
          configVals.getToken(),
          adapter.scope,
        );

        const sigs = await adapterClient.getSigPak();

        // Join the sigpak folder with the adapter name
        const sigpakPath = path.join(configVals.getSigpakPath(), `${adapter.name}.sigpak`);
        sigpakPaths.push(sigpakPath);

        fs.writeFileSync(sigpakPath, sigs.serializeBinary());
      }

      await generateActionStubs(configVals, sigpakPaths);

      await funcTree.refresh();
    }),
  );
}

export function deactivate() {}
