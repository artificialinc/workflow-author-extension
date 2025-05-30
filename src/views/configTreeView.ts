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
import { ArtificialApollo } from '../providers/apolloProvider';

type TreeItem = OrgTreeItem | ConfigTreeItem | LabTreeElement | LabHeaderTreeItem;

export class ConfigTreeView implements vscode.TreeDataProvider<TreeItem>, vscode.TreeDragAndDropController<TreeItem> {
  dropMimeTypes = ['application/vnd.code.tree.configs'];
  dragMimeTypes = ['text/uri-list'];

  private _onDidChangeTreeData: vscode.EventEmitter<TreeItem | undefined | void> = new vscode.EventEmitter<
    TreeItem | undefined | void
  >();

  readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined | void> = this._onDidChangeTreeData.event;
  private uriPath: string;
  constructor(context: vscode.ExtensionContext) {
    const view = vscode.window.createTreeView('configs', {
      treeDataProvider: this,
      showCollapseAll: false,
      canSelectMany: false,
      dragAndDropController: this,
    });
    context.subscriptions.push(view);
    this.uriPath = 'artificial/configs/';
    context.subscriptions.push(vscode.commands.registerCommand('configs.refreshEntry', () => this.refresh()));
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: TreeItem): Promise<TreeItem[]> {
    if (element) {
      if (element.type === 'org') {
        return this.getOrgConfig();
      } else if (element.type === 'labheader') {
        return this.getLabs();
      } else if (element.type === 'lab') {
        if ('labId' in element && element.labId) {
          return this.getLabConfig(element as LabTreeElement);
        }
      }
      return [];
    } else {
      return [new OrgTreeItem('Organization'), new LabHeaderTreeItem('Labs')];
    }
  }

  private async getOrgConfig(): Promise<ConfigTreeItem[]> {
    const apolloClient = ArtificialApollo.getInstance();
    const orgConfigResponse = await apolloClient.queryOrgConfig();
    const parsed = JSON.parse(orgConfigResponse?.getCurrentOrgConfiguration.configValuesDocument ?? '');
    return this.getConfigItems(parsed, 'org');
  }

  private async getLabs(): Promise<LabTreeElement[]> {
    const client = ArtificialApollo.getInstance();
    const response = await client.queryLabs();
    if (!response) {
      return [];
    }
    const labs = response.labs.map((lab): LabTreeElement => {
      return new LabTreeElement(lab.name, lab.id);
    });
    return labs;
  }

  private async getLabConfig(element: LabTreeElement): Promise<ConfigTreeItem[]> {
    const client = ArtificialApollo.getInstance();
    const response = await client.queryLabConfigs(element.labId);
    if (response) {
      const parsed = JSON.parse(response?.getCurrentLabConfiguration.configValuesDocument ?? '');
      return this.getConfigItems(parsed, 'lab', element.labId);
    }
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private getConfigItems(config: any, configType: string, labId = ''): ConfigTreeItem[] {
    const items: ConfigTreeItem[] = [];
    Object.entries(config.configuration).forEach((entry) => {
      const [key, value] = entry;
      if (typeof value === 'string' && value !== null) {
        items.push(new ConfigTreeItem(key, value, configType, labId, vscode.TreeItemCollapsibleState.None));
      }
    });
    return items;
  }
}

class OrgTreeItem extends vscode.TreeItem {
  readonly type: string;
  constructor(public readonly label: string) {
    super(label, vscode.TreeItemCollapsibleState.Collapsed);
    this.tooltip = `${this.label}`;
    this.type = 'org';
  }
  resourceUri = vscode.Uri.parse('artificial/configs/org' + this.label);

  iconPath = new vscode.ThemeIcon('organization');
}

class LabHeaderTreeItem extends vscode.TreeItem {
  readonly type: string;
  constructor(public readonly label: string) {
    super(label, vscode.TreeItemCollapsibleState.Collapsed);
    this.tooltip = `${this.label}`;
    this.type = 'labheader';
  }
  resourceUri = vscode.Uri.parse('artificial/configs/lab' + this.label);

  iconPath = {
    light: vscode.Uri.file(path.join(__filename, '..', '..', 'resources', 'light', 'labs.svg')),
    dark: vscode.Uri.file(path.join(__filename, '..', '..', 'resources', 'dark', 'labs.svg')),
  };
}

class ConfigTreeItem extends vscode.TreeItem {
  readonly type: string;
  constructor(
    public readonly label: string,
    public readonly description: string,
    public readonly configType: string,
    public readonly labId: string = '',
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
  ) {
    super(label, collapsibleState);
    this.tooltip = `${this.label}`;
    this.type = 'config';
  }
  private buildURI() {
    if (!this.labId) {
      return vscode.Uri.parse('artificial/configs/' + this.configType + '/' + this.label);
    } else {
      return vscode.Uri.parse('artificial/configs/' + this.configType + '/' + this.labId + '/' + this.label);
    }
  }
  resourceUri = this.buildURI();

  iconPath = new vscode.ThemeIcon('symbol-property');
}
class LabTreeElement extends vscode.TreeItem {
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
