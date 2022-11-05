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
import { ArtificialApollo } from '../providers/apolloProvider';

export class WorkflowTreeView implements vscode.TreeDataProvider<WorkflowTreeElement> {
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
    context.subscriptions.push(view);
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: WorkflowTreeElement): vscode.TreeItem {
    return element;
  }

  async publishWorkflow(element: WorkflowTreeElement): Promise<void> {
    const success = this.generateWorkflow(element, true);
    if (success) {
      const client = ArtificialApollo.getInstance();
      for (const id in element.workflowIds) {
        const reply = await client.queryAction(element.workflowIds[id]);
        if (reply) {
          await client.deleteAction(element.workflowIds[id]);
        }
      }
    }
    await this.importWorkflow(element.path + '.json');
  }
  // async importWorkflows(actions: File) {
  //   const fd = new FormData();
  //   fd.append('workflows', actions);
  //   return axios.post(hostname(process.env.VUE_APP_DATA_SERVICE_URL) + '/import-workflows', fd, {
  //     withCredentials: true,
  //     headers: { 'content-type': 'application/octet-stream' },
  //   });
  // }

  // TODO: dump output to text file and parse it to check for success?
  async importWorkflow(path: string) {
    let terminal = vscode.window.activeTerminal;
    if (!terminal) {
      terminal = vscode.window.createTerminal(`Artificial-Terminal`);
    }
    terminal.sendText(`wfupload ${path}`);
  }

  //TODO: Throw errors to vscode notification
  generateWorkflow(element: WorkflowTreeElement, json: boolean): boolean {
    let terminal = vscode.window.activeTerminal;
    let path;
    if (!terminal) {
      terminal = vscode.window.createTerminal(`Artificial-Terminal`);
    }
    if (json) {
      path = element.path + '.json';
    } else {
      path = element.path + '.bin';
    }
    if (pathExists(path)) {
      fs.unlink(path, (err) => {
        if (err) {
          console.error(err);
          return;
        }
      });
    }
    if (json) {
      terminal.sendText(`wfgen ${element.path} -j`);
    } else {
      terminal.sendText(`wfgen ${element.path}`);
    }
    if (pathExists(path)) {
      return true;
    }
    return false;
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
            const decoratorName = ast.decorators().decorator(0).dotted_name().text;
            if (decoratorName === 'workflow') {
              isWorkflow = true;
              workflowIds.push(
                ast.decorators().decorator(0).arglist()?.argument(1).test(0).text.replace(new RegExp("'", 'g'), '') ??
                  ''
              );
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
    light: path.join(__filename, '..', '..', '..', 'resources', 'light', 'workflow' + '.svg'),
    dark: path.join(__filename, '..', '..', '..', 'resources', 'dark', 'workflow' + '.svg'),
  };
}
