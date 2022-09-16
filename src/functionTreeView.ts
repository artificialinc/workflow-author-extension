import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { buildPythonFunctionSignatures } from './buildFunctionSignatures';
import { FunctionSignature } from './types';
import { pathExists } from './utils';

export class FunctionTreeView
  implements vscode.TreeDataProvider<AdapterFunction>
{
  constructor(private workspaceRoot: string) {}
  private _onDidChangeTreeData: vscode.EventEmitter<
    AdapterFunction | undefined | null | void
  > = new vscode.EventEmitter<AdapterFunction | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    AdapterFunction | undefined | null | void
  > = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: AdapterFunction): vscode.TreeItem {
    return element;
  }

  getChildren(element?: AdapterFunction): Thenable<AdapterFunction[]> {
    if (!this.workspaceRoot) {
      vscode.window.showInformationMessage('No dependency in empty workspace');
      return Promise.resolve([]);
    }

    if (element) {
      return Promise.resolve(
        this.getFuncsInActionPython(
          path.join(this.workspaceRoot, 'adapters', 'actions.py')
        )
      );
    } else {
      const actionPythonPath = path.join(
        this.workspaceRoot,
        'adapter',
        'actions.py'
      );
      if (pathExists(actionPythonPath)) {
        return Promise.resolve(this.getFuncsInActionPython(actionPythonPath));
      } else {
        vscode.window.showInformationMessage('Workspace has no actions.py');
        return Promise.resolve([]);
      }
    }
  }

  /**
   * Given the path to package.json, read all its dependencies and devDependencies.
   */
  private getFuncsInActionPython(actionPythonPath: string): AdapterFunction[] {
    const functionSignatures = buildPythonFunctionSignatures(actionPythonPath);
    const adapterFunctions = functionSignatures.map(
      (funcName: FunctionSignature): AdapterFunction => {
        return new AdapterFunction(
          funcName.name,
          vscode.TreeItemCollapsibleState.None
        );
      }
    );

    return adapterFunctions;
  }
}

class AdapterFunction extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsibleState);
    this.tooltip = `${this.label}`;
  }

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
