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
    await vscode.tasks.executeTask(
      new vscode.Task(
        { type: 'shell' },
        vscode.TaskScope.Global,
        'Setup Config',
        'Artificial',
        new vscode.ShellExecution('mkdir tmp')
      )
    );
  }
  await vscode.tasks.executeTask(
    new vscode.Task(
      { type: 'shell' },
      vscode.TaskScope.Global,
      'Setup Config',
      'Artificial',
      new vscode.ShellExecution(`afconfig view --yaml > tmp/merged.yaml`)
    )
  );

  // This blocks during the initial activation of the extension,
  // to allow time for the terminal command to complete and hydrate values
  // Post activation of the extension, this sleep fires but doesn't block
  await new Promise((resolve) => setTimeout(resolve, 2000));
}

String.prototype.cleanQuotes = function (): string {
  return this.replace(new RegExp('\'|"', 'g'), '');
};

export function findOrCreateTerminal(showTerminal: boolean = false): vscode.Terminal {
  let terminal = undefined;
  for (const term of vscode.window.terminals) {
    if (term.name === 'Artificial-WF-Terminal') {
      terminal = term;
    }
  }
  if (!terminal) {
    terminal = vscode.window.createTerminal(`Artificial-WF-Terminal`);
  }
  if (showTerminal) {
    terminal.show();
  }
  return terminal;
}

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
