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

export function pathExists(p: string): boolean {
  try {
    fs.accessSync(p);
  } catch (err) {
    return false;
  }
  return true;
}

export async function initConfig(rootPath: string) {
  if (!pathExists(rootPath + '/tmp')) {
    await artificialAwaitTask('tmp Directory Creation', 'mkdir tmp');
  }
  try {
    //await artificialAwaitTask('Setup Config', `afconfig view --yaml > tmp/merged.yaml`);
  } catch {
    const log = OutputLog.getInstance();
    log.log('Error Setting up Configuration');
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
      let ast = parse(source);

      return createVisitor({
        visitDecorated: (ast) => {
          for (let decoratorIndex = 0; decoratorIndex < ast.decorators().childCount; decoratorIndex++) {
            const decoratorName = ast.decorators().decorator(decoratorIndex).dotted_name().text;
            if (decoratorName === 'workflow') {
              isWorkflow = true;
              workflowIds.push(
                ast.decorators().decorator(decoratorIndex).arglist()?.argument(1).test(0).text.cleanQuotes() ?? ''
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
    new vscode.ShellExecution(command)
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
