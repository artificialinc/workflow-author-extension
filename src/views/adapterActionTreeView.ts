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
import { generateActionStubs, pathExists } from '../utils';
import { BuildPythonSignatures } from '../parsers/parseAdapterActionSignatures';
import * as _ from 'lodash';
import { ConfigValues } from '../providers/configProvider';
import { findPythonFiles } from '../utils';

type TreeElement = Module | ArtificialFunction;
export class AdapterActionTreeView
  implements vscode.TreeDataProvider<TreeElement>, vscode.TreeDragAndDropController<TreeElement>
{
  dropMimeTypes = ['application/vnd.code.tree.adapterActions'];
  dragMimeTypes = ['text/uri-list'];

  private _onDidChangeTreeData: vscode.EventEmitter<TreeElement | undefined | void> = new vscode.EventEmitter<
    TreeElement | undefined | void
  >();

  readonly onDidChangeTreeData: vscode.Event<TreeElement | undefined | void> = this._onDidChangeTreeData.event;
  private uriPath: string;
  constructor(context: vscode.ExtensionContext) {
    const view = vscode.window.createTreeView('adapterActions', {
      treeDataProvider: this,
      showCollapseAll: true,
      canSelectMany: false,
      dragAndDropController: this,
    });
    context.subscriptions.push(view);
    this.uriPath = 'artificial/python/';
    context.subscriptions.push(vscode.commands.registerCommand('adapterActions.refreshEntry', () => this.refresh()));
    context.subscriptions.push(
      vscode.commands.registerCommand('adapterActions.generateActionStubs', async () => {
        await generateActionStubs(this.configVals);
        await this.refresh();
      }),
    );
  }

  async init() {
    this.configVals = await ConfigValues.getInstance();
    this.treeElements = [];
    this.treeElements = await this.getChildren();
  }

  async refresh(): Promise<void> {
    this.treeElements = [];
    this.treeElements = await this.getChildren();
    this._onDidChangeTreeData.fire();
  }

  public async handleDrag(
    _source: ArtificialFunction[],
    _treeDataTransfer: vscode.DataTransfer,
    _token: vscode.CancellationToken,
  ): Promise<void> {}

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
  private functionSignatures!: FunctionSignature[];
  private configVals!: ConfigValues;
  async getChildren(element?: TreeElement): Promise<TreeElement[]> {
    if (element) {
      if (element.type === 'module') {
        const functions = this.getFunctions(element.label);
        this.treeElements = this.treeElements.concat(functions);
        return functions.sort((a, b) => a.label?.localeCompare(b.label, 'en', { numeric: true }));
      }
      return [];
    } else {
      if (
        this.configVals.folderBasedStubGenerationEnabled() &&
        pathExists(this.configVals.getAdapterActionStubFolder())
      ) {
        const files = await findPythonFiles(this.configVals.getAdapterActionStubFolder());
        const funcSigBuilder: FunctionSignature[] = [];
        for (const file of files) {
          funcSigBuilder.push(...(await this.getFuncsInActionPython(file)));
        }
        this.functionSignatures = funcSigBuilder;
        const modules = this.getModules();
        this.treeElements = this.treeElements.concat(modules);
        return modules.sort((a, b) => a.moduleName.localeCompare(b.moduleName, 'en', { numeric: true }));
      } else if (pathExists(this.configVals.getAdapterActionStubPath())) {
        this.functionSignatures = await this.getFuncsInActionPython(this.configVals.getAdapterActionStubPath());
        const modules = this.getModules();
        this.treeElements = this.treeElements.concat(modules);
        return modules.sort((a, b) => a.moduleName.localeCompare(b.moduleName, 'en', { numeric: true }));
      } else {
        return [];
      }
    }
  }

  private getModules() {
    let modules = [];
    for (const signature of this.functionSignatures) {
      modules.push(signature.module);
    }
    modules = _.uniq(modules);
    const moduleTreeItems = modules.map((module) => new Module(module));
    return moduleTreeItems;
  }

  private async getFuncsInActionPython(actionPythonPath: string): Promise<FunctionSignature[]> {
    const data = await new BuildPythonSignatures().build(actionPythonPath);
    return data?.sigsAndTypes.functions ? data?.sigsAndTypes.functions : [];
  }

  private getFunctions(moduleName: string | vscode.TreeItemLabel | undefined): ArtificialFunction[] {
    const signatures = this.functionSignatures.map((sig) => {
      if (sig.module === moduleName) {
        return new ArtificialFunction(sig.name, sig);
      }
    });
    const compactedSigs = _.compact(signatures);
    return compactedSigs;
  }
}

export class ArtificialFunction extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly functionSignature: FunctionSignature,
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.tooltip = `${this.label}`;
    this.functionSignature = functionSignature;
    this.contextValue = 'FUNCTION';
  }
  resourceUri = vscode.Uri.parse('artificial/python/' + this.functionSignature.name);
  type = 'function';
  iconPath = {
    light: path.join(__filename, '..', '..', '..', 'resources', 'light', 'pythonActions' + '.svg'),
    dark: path.join(__filename, '..', '..', '..', 'resources', 'dark', 'pythonActions' + '.svg'),
  };
}
export class Module extends vscode.TreeItem {
  constructor(public readonly moduleName: string) {
    super(moduleName, vscode.TreeItemCollapsibleState.Collapsed);
    this.tooltip = `${this.label}`;
  }
  resourceUri = vscode.Uri.parse('artificial/python/module/' + this.moduleName);
  type = 'module';
  iconPath = {
    light: path.join(__filename, '..', '..', 'resources', 'light', 'pythonActions' + '.svg'),
    dark: path.join(__filename, '..', '..', 'resources', 'dark', 'pythonActions' + '.svg'),
  };
}
