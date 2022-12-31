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
import { FunctionSignature } from '../apis/types';
import { pathExists } from '../utils';
import { BuildPythonSignatures } from '../parsers/parsePythonSignatures';

export class PythonTreeView implements vscode.TreeDataProvider<Function>, vscode.TreeDragAndDropController<Function> {
  dropMimeTypes = ['application/vnd.code.tree.pythonActions'];
  dragMimeTypes = ['text/uri-list'];

  private _onDidChangeTreeData: vscode.EventEmitter<Function | undefined | void> = new vscode.EventEmitter<
    Function | undefined | void
  >();

  readonly onDidChangeTreeData: vscode.Event<Function | undefined | void> = this._onDidChangeTreeData.event;
  private uriPath: string;
  constructor(private stubPath: string, context: vscode.ExtensionContext) {
    const view = vscode.window.createTreeView('pythonActions', {
      treeDataProvider: this,
      showCollapseAll: false,
      canSelectMany: false,
      dragAndDropController: this,
    });
    context.subscriptions.push(view);
    this.uriPath = 'artificial/python/';
  }

  async init() {
    this.treeElements = await this.getChildren();
  }

  async refresh(): Promise<void> {
    this.treeElements = await this.getChildren();
    this._onDidChangeTreeData.fire();
  }

  public async handleDrag(
    source: Function[],
    treeDataTransfer: vscode.DataTransfer,
    token: vscode.CancellationToken
  ): Promise<void> {}

  getTreeItem(element: Function): vscode.TreeItem {
    return element;
  }

  getTreeItemByUri(uri: string): Function | undefined {
    const element = this.treeElements.find((sig) => {
      if (sig.resourceUri.toString() === 'file://' + uri) {
        return sig;
      }
    });
    return element;
  }

  private treeElements!: Function[];
  async getChildren(element?: Function): Promise<Function[]> {
    if (element) {
      return [];
    } else {
      if (pathExists(this.stubPath)) {
        this.treeElements = await this.getFuncsInActionPython(this.stubPath);
        return this.treeElements;
      } else {
        //vscode.window.showInformationMessage('Workspace has no stubs');
        return [];
      }
    }
  }

  private async getFuncsInActionPython(actionPythonPath: string): Promise<Function[]> {
    const pythonData = await new BuildPythonSignatures().build(actionPythonPath);
    if (pythonData) {
      const adapterFunctions = pythonData.sigsAndTypes.functions.map((funcName: FunctionSignature): Function => {
        return new Function(funcName.name, vscode.TreeItemCollapsibleState.None, funcName);
      });
      return adapterFunctions;
    }
    return [];
  }
}

export class Function extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly functionSignature: FunctionSignature
  ) {
    super(label, collapsibleState);
    this.tooltip = `${this.label}`;
    this.functionSignature = functionSignature;
  }
  resourceUri = vscode.Uri.parse('artificial/python/' + this.functionSignature.name);

  iconPath = {
    light: path.join(__filename, '..', '..', 'resources', 'light', 'pythonActions' + '.svg'),
    dark: path.join(__filename, '..', '..', 'resources', 'dark', 'pythonActions' + '.svg'),
  };
}
