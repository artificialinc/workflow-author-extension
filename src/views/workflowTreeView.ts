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
import * as path from 'path';
import { pathExists } from '../utils';
import * as fs from 'fs';
import { glob } from 'glob';
import { createVisitor, parse } from 'python-ast';
import { OutputLog } from '../providers/outputLogProvider';
import { findOrCreateTerminal } from '../utils';

export class WorkflowTreeView implements vscode.TreeDataProvider<WorkflowTreeElement> {
  private outputLog!: OutputLog;
  private _onDidChangeTreeData: vscode.EventEmitter<WorkflowTreeElement | undefined | void> = new vscode.EventEmitter<
    WorkflowTreeElement | undefined | void
  >();
  readonly onDidChangeTreeData: vscode.Event<WorkflowTreeElement | undefined | void> = this._onDidChangeTreeData.event;

  constructor(private stubPath: string, context: vscode.ExtensionContext) {
    const view = vscode.window.createTreeView('workflows', {
      treeDataProvider: this,
      showCollapseAll: false,
      canSelectMany: false,
    });
    this.outputLog = OutputLog.getInstance();
    context.subscriptions.push(view);
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: WorkflowTreeElement): vscode.TreeItem {
    return element;
  }

  async publishWorkflow(element: WorkflowTreeElement): Promise<void> {
    const success = await this.generateWorkflow(element, false);
    if (success) {
      const terminal = findOrCreateTerminal(true);
      // If there are multiple workflows in one file
      if (element.workflowIds.length > 1) {
        for (const wfID of element.workflowIds) {
          terminal.sendText(`(wf publish ${element.path.split('.').slice(0, -1).join('.') + '_' + wfID + '.py.bin'})`);
        }
      } else {
        //One workflow in the file
        terminal.sendText(`(wf publish ${element.path + '.bin'})`);
      }
    }
  }

  sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  //TODO: Throw errors to vscode notification
  async generateWorkflow(element: WorkflowTreeElement, json: boolean): Promise<boolean> {
    const terminal = findOrCreateTerminal(true);

    if (json) {
      terminal.sendText(`(cd ${this.stubPath}/workflow; wfgen ${element.path} -j)`);
    } else {
      terminal.sendText(`(cd ${this.stubPath}/workflow; wfgen ${element.path})`);
    }
    // TODO: No good way to tell if previous command has had time to complete
    // For now just sleep 2s, so far wfgen is sub-second to complete.
    // Adding this because sometimes we check to see if its generated too quickly and return false here
    // which skips the publish
    await this.sleep(2000);
    return true;
  }

  async getChildren(element?: WorkflowTreeElement): Promise<WorkflowTreeElement[]> {
    if (element) {
      return [];
    } else {
      if (pathExists(this.stubPath)) {
        const files = this.findPythonFiles();
        const workflows = this.findWorkflowsInFiles(files);
        const elements = [];
        for (const workflow of workflows) {
          elements.push(new WorkflowTreeElement(workflow.path, workflow.ids));
        }
        return elements;
      } else {
        //vscode.window.showInformationMessage('Workspace has no workflows');
        return [];
      }
    }
  }

  private findPythonFiles(): string[] {
    const actionPath = this.stubPath + '/workflow';
    let fileList: string[] = [];
    fileList = glob.sync(actionPath + '/**/*.py');

    return fileList;
  }

  private findWorkflowsInFiles(files: string[]) {
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
}

export class WorkflowTreeElement extends vscode.TreeItem {
  constructor(public readonly label: string, public readonly workflowIds: string[]) {
    super(label);
    collapsibleState: vscode.TreeItemCollapsibleState.None;
    this.tooltip = `${this.label}`;
    const index = label.indexOf('/workflow/');
    // TODO: HACK
    this.label = label.slice(index + 10);
    this.path = label;
  }
  path: string;
  iconPath = {
    light: path.join(__filename, '..', '..', 'resources', 'light', 'workflow' + '.svg'),
    dark: path.join(__filename, '..', '..', 'resources', 'dark', 'workflow' + '.svg'),
  };
}
