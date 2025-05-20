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
import { ArtificialApollo, ConfigReply } from '../providers/apolloProvider';
import { camelCase } from 'lodash';

type TreeElement = LabTreeElement | LoadConfigTreeElement;

export class LoadingConfigByLabTreeView
  implements vscode.TreeDataProvider<TreeElement>, vscode.TreeDragAndDropController<TreeElement>
{
  dropMimeTypes = ['application/vnd.code.tree.loadingConfigByLab'];
  dragMimeTypes = ['text/uri-list'];

  private _onDidChangeTreeData: vscode.EventEmitter<TreeElement | undefined | void> = new vscode.EventEmitter<
    TreeElement | undefined | void
  >();
  readonly onDidChangeTreeData: vscode.Event<TreeElement | undefined | void> = this._onDidChangeTreeData.event;

  private configResponse!: ConfigReply | undefined;

  constructor(context: vscode.ExtensionContext) {
    const view = vscode.window.createTreeView('loadingConfigByLab', {
      treeDataProvider: this,
      showCollapseAll: true,
      canSelectMany: false,
      dragAndDropController: this,
    });
    context.subscriptions.push(view);
    this.treeElements = [];

    context.subscriptions.push(
      vscode.commands.registerCommand('loadingConfigByLab.refreshEntry', () => this.refresh()),
      vscode.commands.registerCommand('loadingConfigByLab.copyID', (node: LoadConfigTreeElement) =>
        this.copyID(node.configId),
      ),
    );
  }

  public async init(): Promise<void> {
    const client = ArtificialApollo.getInstance();
    this.configResponse = await client.queryConfigs();
    this.treeElements = await this.getChildren();
    this._onDidChangeTreeData.fire();
    return;
  }

  async refresh(): Promise<void> {
    this.treeElements = [];
    const client = ArtificialApollo.getInstance();
    this.configResponse = await client.queryConfigs();
    this.treeElements = await this.getChildren();
    this._onDidChangeTreeData.fire();
  }

  public async handleDrag(
    _source: TreeElement[],
    _treeDataTransfer: vscode.DataTransfer,
    _token: vscode.CancellationToken,
  ): Promise<void> {}

  copyID(configId: string): void {
    vscode.env.clipboard.writeText(configId);
  }

  getTreeItem(element: TreeElement): vscode.TreeItem {
    return element;
  }

  getTreeItemByUri(uri: string): TreeElement | undefined {
    const element = this.treeElements.find((sig) => {
      if (sig.resourceUri.toString() === uri) {
        return sig;
      }
    });
    return element;
  }

  private treeElements!: TreeElement[];
  async getChildren(element?: TreeElement): Promise<TreeElement[]> {
    if (element) {
      if (element.type === 'lab') {
        const configs: LoadConfigTreeElement[] = [];
        this.configResponse?.labs.forEach((value) => {
          if (element.labId === value.id) {
            value.loadingConfigs.forEach((config) => {
              configs.push(new LoadConfigTreeElement(config.name, config.id, value.id, value.name));
            });
            this.treeElements = this.treeElements.concat(configs);
            return configs.sort((a, b) => a.label.localeCompare(b.label, 'en', { numeric: true }));
          }
          return [];
        });
        return configs;
      }
      return [];
    } else {
      this.configResponse?.labs[0].name;
      const labs: LabTreeElement[] = [];
      this.configResponse?.labs.forEach((element) => {
        if (element.loadingConfigs.length > 0) {
          labs.push(new LabTreeElement(element.name, element.id));
        }
      });
      this.treeElements = this.treeElements.concat(labs);
      return labs.sort((a, b) => a.label.localeCompare(b.label, 'en', { numeric: true }));
    }
  }
}

export class LoadConfigTreeElement extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly configId: string,
    public readonly labId: string,
    public readonly labName: string,
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.tooltip = `${this.label}`;
    this.contextValue = 'LOADINGCONFIG';
  }
  labClassName =
    this.labName.charAt(0).toUpperCase() + camelCase(this.labName.toLowerCase()).slice(1) + 'LoadingConfigs';
  resourceUri = vscode.Uri.parse(
    'artificial/loadingConfigsByLab/loadingConfig/' + this.labClassName + '/' + this.label,
  );
  type = 'loadingConfig';
  iconPath = new vscode.ThemeIcon('beaker');
}

export class LabTreeElement extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly labId: string,
  ) {
    super(label, vscode.TreeItemCollapsibleState.Collapsed);
    this.tooltip = `${this.label}`;
  }
  resourceUri = vscode.Uri.parse('artificial/loadConfigs/' + 'lab/' + this.labId);
  type = 'lab';
  iconPath = {
    light: vscode.Uri.file(path.join(__filename, '..', '..', 'resources', 'light', 'labs.svg')),
    dark: vscode.Uri.file(path.join(__filename, '..', '..', 'resources', 'dark', 'labs.svg')),
  };
}
