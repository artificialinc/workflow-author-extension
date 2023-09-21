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
import { ConfigValues } from '../providers/configProvider';
import { artificialAwaitTask, artificialTask, pathExists } from '../utils';
import { glob } from 'glob';
import { findLabAndAssistantsInFiles } from '../utils';
import * as path from 'path';
import * as _ from 'lodash';
type TreeItem = AssistantHeaderTreeItem | LabHeaderTreeItem | DataTreeItem;
enum DialogResponses {
  ok = 'OK',
  cancel = 'Cancel',
}
enum TreeItemTypes {
  lab = 'lab',
  assistant = 'assistant',
  labheader = 'labheader',
  assistantheader = 'assistantheader',
}
export class DataTreeView implements vscode.TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<TreeItem | undefined | void> = new vscode.EventEmitter<
    TreeItem | undefined | void
  >();
  readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined | void> = this._onDidChangeTreeData.event;
  constructor(private rootPath: string, context: vscode.ExtensionContext) {
    const view = vscode.window.createTreeView('labAsstData', {
      treeDataProvider: this,
      showCollapseAll: false,
      canSelectMany: false,
    });
    context.subscriptions.push(view);
    context.subscriptions.push(vscode.commands.registerCommand('labAsstData.exportData', () => this.exportData()));
    context.subscriptions.push(vscode.commands.registerCommand('labAsstData.importData', () => this.importData()));
    context.subscriptions.push(
      vscode.commands.registerCommand('labAsstData.importDataSingle', (element: TreeItem) =>
        this.importDataSingle(element as DataTreeItem)
      )
    );
    context.subscriptions.push(
      vscode.commands.registerCommand('labAsstData.exportDataSingle', (element: TreeItem) =>
        this.exportDataSingle(element as DataTreeItem)
      )
    );
  }
  async getChildren(element?: TreeItem): Promise<TreeItem[]> {
    let labsAndAssistants: { path: string; id: string; name: string; type: string }[] = [];
    if (pathExists(this.rootPath)) {
      const files = this.findJsonFiles();
      labsAndAssistants = findLabAndAssistantsInFiles(files);
    }
    if (element) {
      if (element?.type === TreeItemTypes.labheader) {
        const labs = _.compact(
          labsAndAssistants.map((item) => {
            if (item.type === TreeItemTypes.lab) {
              return new DataTreeItem(item.name, item.path, item.id, TreeItemTypes.lab);
            }
          })
        );

        if (labs) {
          return labs.sort((a, b) => a.label.localeCompare(b.label, 'en', { numeric: true }));
        }
      }
      if (element?.type === TreeItemTypes.assistantheader) {
        const assistants = _.compact(
          labsAndAssistants.map((item) => {
            if (item.type === TreeItemTypes.assistant) {
              return new DataTreeItem(item.name, item.path, item.id, TreeItemTypes.assistant);
            }
          })
        );
        if (assistants) {
          return assistants.sort((a, b) => a.label.localeCompare(b.label, 'en', { numeric: true }));
        }
      }
      return [];
    } else {
      if (labsAndAssistants.length) {
        return [new LabHeaderTreeItem('Labs'), new AssistantHeaderTreeItem('Assistants')];
      } else {
        return [];
      }
    }
  }
  private findJsonFiles(): string[] {
    const actionPath = this.rootPath + '/data';
    let fileList: string[] = [];
    fileList = glob.sync(actionPath + '/**/*.json');

    return fileList;
  }
  refresh(): void {
    this._onDidChangeTreeData.fire();
  }
  getTreeItem(element: TreeItem): TreeItem {
    return element;
  }
  async importDataSingle(element: DataTreeItem): Promise<void> {
    const config = ConfigValues.getInstance();
    const token = config.getToken();
    const server = config.getHost();
    const response = await vscode.window.showInformationMessage(
      'This will overwrite cloud data, Continue?',
      DialogResponses.ok,
      DialogResponses.cancel
    );
    if (response === DialogResponses.ok) {
      if (element.type === TreeItemTypes.assistant) {
        await artificialTask(
          'Import Assistant',
          `cat ${element.filePath} | artificial-cli data importWorkflow --quiet -s ${server} -t ${token}`
        );
      }
      if (element.type === TreeItemTypes.lab) {
        await artificialTask(
          'Import Lab',
          `cat ${element.filePath} | artificial-cli data importLab --quiet -s ${server} -t ${token}`
        );
      }
    }
  }
  async exportDataSingle(element: DataTreeItem): Promise<void> {
    const config = ConfigValues.getInstance();
    const token = config.getToken();
    const server = config.getHost();
    if (element.type === TreeItemTypes.assistant) {
      await artificialTask(
        'Export Assistant',
        `artificial-cli data exportWorkflow ${element.id} --quiet -s ${server} -t ${token} > ${element.filePath}`
      );
    }
    if (element.type === TreeItemTypes.lab) {
      await artificialTask(
        'Export Lab',
        `artificial-cli data exportLab ${element.id}  --quiet --min -s ${server} -t ${token} > ${element.filePath}`
      );
    }
  }
  async exportData() {
    if (!pathExists(this.rootPath + '/data')) {
      await artificialAwaitTask('Data Directory Creation', `mkdir data`);
    }
    const config = ConfigValues.getInstance();
    const token = config.getToken();
    const server = config.getHost();
    await artificialTask(
      'Export Labs/Assistants',
      `artificial-cli data exportManifest --quiet --local --min -x 50000 -s ${server} -t ${token} -d data -m data/manifest.yaml`
    );
  }
  async importData() {
    const config = ConfigValues.getInstance();
    const token = config.getToken();
    const server = config.getHost();
    const response = await vscode.window.showInformationMessage(
      'This will overwrite cloud data, Continue?',
      DialogResponses.ok,
      DialogResponses.cancel
    );
    if (response === DialogResponses.ok) {
      await artificialTask(
        'Import Labs/Assistants',
        `artificial-cli data importManifest --quiet -x 50000 -s ${server} -t ${token} -m data/manifest.yaml`
      );
    }
  }
}
class LabHeaderTreeItem extends vscode.TreeItem {
  readonly type: string;
  constructor(public readonly label: string) {
    super(label, vscode.TreeItemCollapsibleState.Collapsed);
    this.tooltip = `${this.label}`;
    this.type = TreeItemTypes.labheader;
  }
  resourceUri = vscode.Uri.parse('artificial/datatree/lab' + this.label);

  iconPath = {
    light: path.join(__filename, '..', '..', 'resources', 'light', 'labs.svg'),
    dark: path.join(__filename, '..', '..', 'resources', 'dark', 'labs.svg'),
  };
}
class AssistantHeaderTreeItem extends vscode.TreeItem {
  readonly type: string;
  constructor(public readonly label: string) {
    super(label, vscode.TreeItemCollapsibleState.Collapsed);
    this.tooltip = `${this.label}`;
    this.type = TreeItemTypes.assistantheader;
  }
  resourceUri = vscode.Uri.parse('artificial/datatree/lab' + this.label);

  iconPath = {
    light: path.join(__filename, '..', '..', 'resources', 'light', 'assistants.svg'),
    dark: path.join(__filename, '..', '..', 'resources', 'dark', 'assistants.svg'),
  };
}

class DataTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly filePath: string,
    public readonly id: string,
    public readonly type: string
  ) {
    super(label);
    collapsibleState: vscode.TreeItemCollapsibleState.None;
    this.tooltip = `${this.filePath}`;
    this.contextValue = 'DATA';
    this.command = {
      command: 'vscode.open',
      title: 'Open Call',
      arguments: [
        vscode.Uri.file(this.filePath),
        <vscode.TextDocumentShowOptions>{
          preserveFocus: true,
        },
      ],
    };
  }
}
