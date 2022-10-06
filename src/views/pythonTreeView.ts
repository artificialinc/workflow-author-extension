import * as vscode from 'vscode';
import * as path from 'path';
import { FunctionSignature } from '../apis/types';
import { pathExists } from '../utils';
import { BuildPythonSignatures } from '../parsers/parsePythonSignatures';

export class PythonTreeView implements vscode.TreeDataProvider<Function>, vscode.TreeDragAndDropController<Function> {
  dropMimeTypes = ['application/vnd.code.tree.stubs'];
  dragMimeTypes = ['text/uri-list'];

  private _onDidChangeTreeData: vscode.EventEmitter<Function | undefined | void> = new vscode.EventEmitter<
    Function | undefined | void
  >();

  readonly onDidChangeTreeData: vscode.Event<Function | undefined | void> = this._onDidChangeTreeData.event;
  private uriPath: string;
  constructor(private stubPath: string, context: vscode.ExtensionContext) {
    const view = vscode.window.createTreeView('stubs', {
      treeDataProvider: this,
      showCollapseAll: false,
      canSelectMany: false,
      dragAndDropController: this,
    });
    context.subscriptions.push(view);
    this.treeElements = this.getChildren();
    this.uriPath = 'artificial/python/';
  }

  refresh(): void {
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
    const functionSignatures = new BuildPythonSignatures().build(actionPythonPath);
    const adapterFunctions = functionSignatures.map((funcName: FunctionSignature): Function => {
      return new Function(funcName.name, vscode.TreeItemCollapsibleState.None, funcName);
    });

    return adapterFunctions;
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
    light: path.join(__filename, '..', '..', '..', 'resources', 'light', 'stubs' + '.svg'),
    dark: path.join(__filename, '..', '..', '..', 'resources', 'dark', 'stubs' + '.svg'),
  };
}
