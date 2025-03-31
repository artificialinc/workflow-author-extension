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

import * as fs from 'fs';
import * as vscode from 'vscode';
import { createVisitor, parse } from 'python-ast';
import { OutputLog } from './providers/outputLogProvider';
import { ConfigValues } from './providers/configProvider';
import * as path from 'path';

export function pathExists(p: string): boolean {
  try {
    fs.accessSync(p);
  } catch {
    return false;
  }
  return true;
}

export async function initConfig(rootPath: string) {
  if (!pathExists(rootPath + '/tmp')) {
    await artificialAwaitTask('tmp Directory Creation', 'mkdir tmp');
  }
  try {
    const pythonInterpreter = await ConfigValues.getPythonInterpreter();
    await artificialAwaitTask('Setup Config', `${pythonInterpreter}/afconfig view --yaml > tmp/merged.yaml`);
  } catch {
    const log = OutputLog.getInstance();
    log.log('Error Setting up Configuration');
  }
}

export async function addFileToContext(file: string, filename: string) {
  try {
    const pythonInterpreter = await ConfigValues.getPythonInterpreter();
    await artificialAwaitTask('Add File to Context', `${pythonInterpreter}/afconfig add-file ${filename} '${file}'`);
  } catch {
    const log = OutputLog.getInstance();
    log.log(
      'Error Adding File to Context. The artificial-common package may be outdated. v0.2.3 or newer is required.',
    );
  }
}

String.prototype.cleanQuotes = function (): string {
  return this.replace(new RegExp('\'|"', 'g'), '');
};

export function findWorkflowsInFiles(files: string[]) {
  const workflows: { path: string; ids: string[] }[] = [];
  for (const file of files) {
    const pythonFile = fs.readFileSync(file, 'utf-8');
    let isWorkflow = false;
    const workflowIds: string[] = [];
    const findWorkflow = (source: string) => {
      const ast = parse(source);

      return createVisitor({
        visitDecorated: (ast) => {
          for (let decoratorIndex = 0; decoratorIndex < ast.decorators().childCount; decoratorIndex++) {
            const decoratorName = ast.decorators().decorator(decoratorIndex).dotted_name().text;
            if (decoratorName === 'workflow') {
              isWorkflow = true;
              workflowIds.push(
                ast.decorators().decorator(decoratorIndex).arglist()?.argument(1).test(0).text.cleanQuotes() ?? '',
              );
            }
          }
        },
      }).visit(ast);
    };
    findWorkflow(pythonFile);
    if (isWorkflow) {
      workflows.push({ path: file, ids: workflowIds });
    }
  }
  return workflows;
}

export function artificialTask(name: string, command: string) {
  const task = new vscode.Task(
    { type: 'shell' },
    vscode.TaskScope.Global,
    name,
    'Artificial',
    new vscode.ShellExecution(command),
  );
  task.presentationOptions.focus = false;
  task.presentationOptions.reveal = vscode.TaskRevealKind.Silent;
  return vscode.tasks.executeTask(task);
}

export async function artificialAwaitTask(name: string, command: string) {
  await artificialTask(name, command);

  return new Promise((resolve, reject) => {
    const eventDisposable = vscode.tasks.onDidEndTaskProcess((e) => {
      if (e.execution.task.name === name) {
        if (e.exitCode === 0) {
          resolve('ok');
        } else {
          reject();
        }
        eventDisposable.dispose();
      }
    });
  });
}

export function findLabAndAssistantsInFiles(files: string[]) {
  const labsAndAssistants: { path: string; id: string; name: string; type: string }[] = [];
  for (const file of files) {
    const jsonFile = fs.readFileSync(file, 'utf-8');
    if (jsonFile) {
      const obj = JSON.parse(jsonFile);
      if (obj.lab) {
        labsAndAssistants.push({ path: file, id: obj.lab.id, name: obj.lab.name, type: 'lab' });
      }
      if (obj.workflow) {
        labsAndAssistants.push({ path: file, id: obj.workflow.id, name: obj.workflow.name, type: 'assistant' });
      }
    }
  }
  return labsAndAssistants;
}

export async function findPythonFiles(dir: string): Promise<string[]> {
  let pythonFiles: string[] = [];

  const files = await fs.promises.readdir(dir, { withFileTypes: true });

  for (const file of files) {
    const fullPath = path.join(dir, file.name);

    if (file.isDirectory()) {
      // Recursively search inside subdirectories
      const subFiles = await findPythonFiles(fullPath);
      pythonFiles = pythonFiles.concat(subFiles);
    } else if (file.isFile() && file.name.endsWith('.py')) {
      // If it's a Python file, add it to the list
      pythonFiles.push(fullPath);
    }
  }

  return pythonFiles;
}

export async function generateActionStubs(configVals: ConfigValues, sigpak?: string): Promise<void> {
  const module = vscode.workspace.getConfiguration('artificial.workflow.author').modulePath;
  const pythonInterpreter = await ConfigValues.getPythonInterpreter();
  let stubPath = '';
  let cmd = `(cd adapter; ${pythonInterpreter}/wf adapterstubs`;
  let reqVersion = '';
  if (configVals.folderBasedStubGenerationEnabled()) {
    stubPath = configVals.getAdapterActionStubFolder();
    // Delete the folder if it exists
    if (pathExists(stubPath)) {
      fs.rmdirSync(stubPath, { recursive: true });
    }
    // Create the folder
    fs.mkdirSync(stubPath);
    cmd += ` --hierarchical -o ${stubPath}`;
    if (sigpak) {
      cmd += ` --input ${sigpak}`;
      reqVersion = '0.13.1';
    } else {
      cmd += ` ${module}`;
      reqVersion = '0.13.0';
    }
  } else {
    stubPath = configVals.getAdapterActionStubPath();
    cmd += ` -o ${stubPath}`;
    if (sigpak) {
      cmd += ` --input ${sigpak}`;
      reqVersion = '0.13.1';
    } else {
      cmd += ` ${module}`;
    }
  }

  if (reqVersion) {
    try {
      await artificialAwaitTask(
        'Check artificial-workflows-tools Version',
        `${pythonInterpreter}/wf version --check ">=${reqVersion}"`,
      );
    } catch {
      return;
    }
  }

  await artificialAwaitTask('Generate Action Stubs', `${cmd})`);
}
