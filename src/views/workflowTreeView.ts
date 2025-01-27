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
import { ConfigValues } from '../providers/configProvider';

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
    const wfFileName = path.split('/').pop();
    const generateTaskName = 'Generate Workflow: ' + wfFileName;
    const publishTaskName = 'Publish Workflow: ';
    const pythonInterpreter = await ConfigValues.getPythonInterpreter();

    try {
      await artificialAwaitTask(generateTaskName, `(cd ${this.stubPath}/workflow; ${pythonInterpreter}/wfgen ${path})`);
    } catch {
      outputLog.log('Generate Failed, Skipping Publish');
      return;
    }

    // If there are multiple workflows in one file
    if (workflowIds.length > 1) {
      for (const wfID of workflowIds) {
        await artificialTask(
          publishTaskName + wfID,
          `(${pythonInterpreter}/wf publish ${path.split('.').slice(0, -1).join('.') + '_' + wfID + '.py.bin'})`
        );
      }
    } else {
      //One workflow in the file
      await artificialTask(publishTaskName + wfFileName, `(${pythonInterpreter}/wf publish ${path + '.bin'})`);
    }
  }

  sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async generateWorkflow(path: string, json: boolean) {
    let jsonFlag = '';
    if (json) {
      jsonFlag = '-j';
    }
    const pythonInterpreter = await ConfigValues.getPythonInterpreter();
    await artificialTask('Generate Workflow', `(cd ${this.stubPath}/workflow; ${pythonInterpreter}/wfgen ${path} ${jsonFlag})`);
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
