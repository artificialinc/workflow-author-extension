import * as vscode from 'vscode';
import * as path from 'path';
import { BuildFunctionSignatures } from './buildFunctionSignatures';
import { FunctionSignature } from './types';
import { pathExists } from './utils';

export class ArtificialTreeView
  implements vscode.TreeDataProvider<Function>, vscode.TreeDragAndDropController<Function>
{
  dropMimeTypes = ['application/vnd.code.tree.stubs'];
  dragMimeTypes = ['text/uri-list'];

  private _onDidChangeTreeData: vscode.EventEmitter<Function | undefined | void> = new vscode.EventEmitter<
    Function | undefined | void
  >();

  readonly onDidChangeTreeData: vscode.Event<Function | undefined | void> = this._onDidChangeTreeData.event;

  constructor(
    private stubPath: string,
    private uriPath: string,
    private vscodeID: string,
    context: vscode.ExtensionContext
  ) {
    const view = vscode.window.createTreeView(this.vscodeID, {
      treeDataProvider: this,
      showCollapseAll: false,
      canSelectMany: false,
      dragAndDropController: this,
    });
    context.subscriptions.push(view);
    this.treeElements = this.getChildren();
  }
  refresh(): void {
    this._onDidChangeTreeData.fire();
  }
  public async handleDrag(
    source: Function[],
    treeDataTransfer: vscode.DataTransfer,
    token: vscode.CancellationToken
  ): Promise<void> {
    // treeDataTransfer.set(
    //   'application/vnd.code.tree.stubs',
    //   new vscode.DataTransferItem(source)
    // );
  }

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

  private treeElements: Function[];
  getChildren(element?: Function): Function[] {
    if (element) {
      return [];
    } else {
      if (pathExists(this.stubPath)) {
        this.treeElements = this.getFuncsInActionPython(this.stubPath);
        return this.treeElements;
      } else {
        vscode.window.showInformationMessage('Workspace has no stubs');
        return [];
      }
    }
  }

  private getFuncsInActionPython(actionPythonPath: string): Function[] {
    const functionSignatures = new BuildFunctionSignatures().build(actionPythonPath);
    const adapterFunctions = functionSignatures.map((funcName: FunctionSignature): Function => {
      return new Function(funcName.name, vscode.TreeItemCollapsibleState.None, funcName, this.uriPath, this.vscodeID);
    });

    return adapterFunctions;
  }
}

export class Function extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly functionSignature: FunctionSignature,
    public readonly uriPath: string,
    public readonly icon: string
  ) {
    super(label, collapsibleState);
    this.tooltip = `${this.label}`;
    this.functionSignature = functionSignature;
    this.uriPath = uriPath;
    this.icon = icon;
  }
  resourceUri = vscode.Uri.parse(this.uriPath + this.functionSignature.name);

  iconPath = {
    light: path.join(__filename, '..', '..', 'resources', 'light', this.icon + '.svg'),
    dark: path.join(__filename, '..', '..', 'resources', 'dark', this.icon + '.svg'),
  };
}
