import * as vscode from 'vscode';
import * as path from 'path';
import { BuildFunctionSignatures } from './buildFunctionSignatures';
import { FunctionSignature } from './types';
import { pathExists } from './utils';

export class FunctionTreeView
  implements
    vscode.TreeDataProvider<AdapterFunction>,
    vscode.TreeDragAndDropController<AdapterFunction>
{
  dropMimeTypes = ['application/vnd.code.tree.stubs'];
  dragMimeTypes = ['text/uri-list'];
  //constructor(private workspaceRoot: string) {}
  constructor(private workspaceRoot: string, context: vscode.ExtensionContext) {
    const view = vscode.window.createTreeView('stubs', {
      treeDataProvider: this,
      showCollapseAll: false,
      canSelectMany: false,
      dragAndDropController: this,
    });
    context.subscriptions.push(view);
  }

  public async handleDrag(
    source: AdapterFunction[],
    treeDataTransfer: vscode.DataTransfer,
    token: vscode.CancellationToken
  ): Promise<void> {
    // treeDataTransfer.set(
    //   'application/vnd.code.tree.stubs',
    //   new vscode.DataTransferItem(source)
    // );
    //treeDataTransfer.set('text/uri-list', new vscode.DataTransferItem('thing'));
  }

  getTreeItem(element: AdapterFunction): vscode.TreeItem {
    return element;
  }

  getChildren(element?: AdapterFunction): AdapterFunction[] {
    if (element) {
      return [];
    } else {
      const actionPythonPath = path.join(
        this.workspaceRoot,
        'adapter',
        'actions.py'
      );
      if (pathExists(actionPythonPath)) {
        return this.getFuncsInActionPython(actionPythonPath);
      } else {
        vscode.window.showInformationMessage('Workspace has no actions.py');
        return [];
      }
    }
  }

  /**
   * Given the path to package.json, read all its dependencies and devDependencies.
   */
  private getFuncsInActionPython(actionPythonPath: string): AdapterFunction[] {
    const functionSignatures = new BuildFunctionSignatures().build(
      actionPythonPath
    );
    const adapterFunctions = functionSignatures.map(
      (funcName: FunctionSignature): AdapterFunction => {
        return new AdapterFunction(
          funcName.name,
          vscode.TreeItemCollapsibleState.None,
          funcName
        );
      }
    );

    return adapterFunctions;
  }
}

export class AdapterFunction extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly functionSignature: FunctionSignature
  ) {
    super(label, collapsibleState);
    this.tooltip = `${this.label}`;
    this.functionSignature = functionSignature;
  }
  resourceUri = vscode.Uri.parse(
    `\nawait load_deck(\n    num_empty_tubes= ,\n    num_tube_racks= ,\n    num_deepwell= ,\n    num_treatment= ,\n    num_final= ,\n    num_lids= ,\n)`
  );
  iconPath = {
    light: path.join(
      __filename,
      '..',
      '..',
      'resources',
      'light',
      'dependency.svg'
    ),
    dark: path.join(
      __filename,
      '..',
      '..',
      'resources',
      'dark',
      'dependency.svg'
    ),
  };
}
