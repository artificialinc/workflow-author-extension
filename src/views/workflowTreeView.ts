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
import { artificialAwaitTask, artificialTask, pathExists } from '../utils';
import { glob } from 'glob';
import { findWorkflowsInFiles } from '../utils';
import { OutputLog } from '../providers/outputLogProvider';

export class WorkflowTreeView implements vscode.TreeDataProvider<WorkflowTreeElement> {
  private _onDidChangeTreeData: vscode.EventEmitter<WorkflowTreeElement | undefined | void> = new vscode.EventEmitter<
    WorkflowTreeElement | undefined | void
  >();
  readonly onDidChangeTreeData: vscode.Event<WorkflowTreeElement | undefined | void> = this._onDidChangeTreeData.event;
  public taskResolvers: [{ resolve: (value: any) => void; reject: () => void } | undefined] | [] = [];
  constructor(private stubPath: string, context: vscode.ExtensionContext) {
    const view = vscode.window.createTreeView('workflows', {
      treeDataProvider: this,
      showCollapseAll: false,
      canSelectMany: false,
    });
    context.subscriptions.push(
      view,
      vscode.commands.registerCommand('workflows.refreshEntry', () => this.refresh()),
      vscode.commands.registerCommand('workflows.publish', (path: string, workflowIDs: string[]) =>
        this.publishWorkflow(path, workflowIDs)
      ),
      vscode.commands.registerCommand('workflows.treePublish', (node: WorkflowTreeElement) =>
        this.publishWorkflow(node.path, node.workflowIds)
      ),
      vscode.commands.registerCommand('workflows.generateBinary', (node: WorkflowTreeElement) =>
        this.generateWorkflow(node.path, false)
      ),
      vscode.commands.registerCommand('workflows.generateJson', (node: WorkflowTreeElement) =>
        this.generateWorkflow(node.path, true)
      )
    );
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: WorkflowTreeElement): vscode.TreeItem {
    return element;
  }

  async publishWorkflow(path: string, workflowIds: string[]): Promise<void> {
    const outputLog = OutputLog.getInstance();
    const taskName = 'Generate Workflow';
    const wfName = path.split('/').pop();
    const taskId = taskName + ' ' + wfName;
    try {
      await artificialAwaitTask(taskId, `(cd ${this.stubPath}/workflow; wfgen ${path})`);
    } catch {
      outputLog.log('Generate Failed, Skipping Publish');
      return;
    }

    // If there are multiple workflows in one file
    if (workflowIds.length > 1) {
      for (const wfID of workflowIds) {
        await artificialTask(
          'Publish Workflow',
          `(wf publish ${path.split('.').slice(0, -1).join('.') + '_' + wfID + '.py.bin'})`
        );
      }
    } else {
      //One workflow in the file
      await artificialTask('Publish Workflow', `(wf publish ${path + '.bin'})`);
    }
  }

  sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  //TODO: Throw errors to vscode notification
  async generateWorkflow(path: string, json: boolean): Promise<boolean> {
    if (json) {
      await artificialTask('Generate Workflow', `(cd ${this.stubPath}/workflow; wfgen ${path} -j)`);
    } else {
      await artificialTask('Generate Workflow', `(cd ${this.stubPath}/workflow; wfgen ${path})`);
    }
    // TODO: No good way to tell if previous command has had time to complete
    // For now just sleep 2s, so far wfgen is sub-second to complete.
    // Adding this because sometimes we check to see if its generated too quickly and return false here
    // which skips the publish
    await this.sleep(2000);
    // TODO: echo $1 > tmp/file the exit status code of wfgen
    //       Read the file for 0 or 1, notify error and cancel publish
    return true;
  }

  async getChildren(element?: WorkflowTreeElement): Promise<WorkflowTreeElement[]> {
    if (element) {
      return [];
    } else {
      if (pathExists(this.stubPath)) {
        const files = this.findPythonFiles();
        const workflows = findWorkflowsInFiles(files);
        const elements = [];
        for (const workflow of workflows) {
          elements.push(new WorkflowTreeElement(workflow.path, workflow.ids));
        }
        return elements.sort((a, b) => a.label.localeCompare(b.label, 'en', { numeric: true }));
      } else {
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
}

class WorkflowTreeElement extends vscode.TreeItem {
  constructor(public readonly label: string, public readonly workflowIds: string[]) {
    super(label);
    collapsibleState: vscode.TreeItemCollapsibleState.None;
    this.tooltip = `${this.label}`;
    const index = label.indexOf('/workflow/');
    // TODO: HACK
    this.label = label.slice(index + 10);
    this.path = label;
    // TODO: This open command isnt working inside a dev container
    this.command = {
      command: 'vscode.open',
      title: 'Open Call',
      arguments: [
        vscode.Uri.file(this.tooltip),
        <vscode.TextDocumentShowOptions>{
          preserveFocus: true,
        },
      ],
    };
  }
  path: string;
  iconPath = {
    light: path.join(__filename, '..', '..', 'resources', 'light', 'workflow' + '.svg'),
    dark: path.join(__filename, '..', '..', 'resources', 'dark', 'workflow' + '.svg'),
  };
}
