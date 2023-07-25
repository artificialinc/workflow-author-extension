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
import { findOrCreateTerminal } from '../utils';
import { ConfigValues } from '../providers/configProvider';

export class DataTreeView implements vscode.TreeDataProvider<vscode.TreeItem> {
  private token: string;
  private server: string;
  constructor(context: vscode.ExtensionContext) {
    const view = vscode.window.createTreeView('labAsstData', {
      treeDataProvider: this,
      showCollapseAll: false,
      canSelectMany: false,
    });
    context.subscriptions.push(view);
    context.subscriptions.push(vscode.commands.registerCommand('labAsstData.exportData', () => this.exportData()));
    context.subscriptions.push(vscode.commands.registerCommand('labAsstData.importData', () => this.importData()));

    const config = ConfigValues.getInstance();
    this.token = config.getToken();
    this.server = config.getHost();
  }
  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    return [];
  }
  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }
  exportData() {
    const terminal = findOrCreateTerminal();
    terminal.sendText(
      `artificial-cli data exportManifest --quiet --min -x 50000 -s ${this.server} -t ${this.token} -d data -m data/manifest.yaml`
    );
  }
  importData() {
    const terminal = findOrCreateTerminal();
    terminal.sendText(
      `artificial-cli data importManifest -x 50000 -s ${this.server} -t ${this.token} -m data/manifest.yaml`
    );
  }
}