import * as vscode from 'vscode';
import * as path from 'path';
import { pathExists } from '../utils';
import * as fs from 'fs';
import { glob } from 'glob';
import { createVisitor, parse } from 'python-ast';

export class WorkflowTreeView implements vscode.TreeDataProvider<WorkflowTreeElement> {
  private _onDidChangeTreeData: vscode.EventEmitter<WorkflowTreeElement | undefined | void> = new vscode.EventEmitter<
    WorkflowTreeElement | undefined | void
  >();
  readonly onDidChangeTreeData: vscode.Event<WorkflowTreeElement | undefined | void> = this._onDidChangeTreeData.event;

  constructor(private stubPath: string, context: vscode.ExtensionContext) {
    const view = vscode.window.createTreeView('workflows', {
      treeDataProvider: this,
      showCollapseAll: false,
      canSelectMany: false,
    });
    context.subscriptions.push(view);
  }
  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: WorkflowTreeElement): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: WorkflowTreeElement): Promise<WorkflowTreeElement[]> {
    if (element) {
      return [];
    } else {
      if (pathExists(this.stubPath)) {
        const files = this.findPythonFiles();
        const workflows = this.findWorkflowsInFiles(files);

        return [new WorkflowTreeElement('test')];
      } else {
        vscode.window.showInformationMessage('Workspace has no stubs');
        return [];
      }
    }
  }

  private findPythonFiles(): string[] {
    const actionPath = this.stubPath + '/workflow';
    let fileList: string[] = [];
    fileList = glob.sync(actionPath + '/**/*.py');

    return fileList;
  }

  private findWorkflowsInFiles(files: string[]) {
    for (const file of files) {
      const pythonFile = fs.readFileSync(file, 'utf-8');
      let isWorkflow = false;
      const findWorkflow = (source: string) => {
        let ast = parse(source);

        return createVisitor({
          visitDecorated: (ast) => {
            const decoratorName = ast.decorators().decorator(0).dotted_name().text;
            if (decoratorName === 'workflow') {
              isWorkflow = true;
            }
          },
        }).visit(ast);
      };
      findWorkflow(pythonFile);
      if (isWorkflow) {
        // TODO: Return workflow ID, and path
        console.log(file);
      }
    }
  }
}

export class WorkflowTreeElement extends vscode.TreeItem {
  constructor(public readonly label: string) {
    super(label);
    collapsibleState: vscode.TreeItemCollapsibleState.None;
    this.tooltip = `${this.label}`;
  }
  resourceUri = vscode.Uri.parse('artificial/workflows/' + this.label);

  iconPath = {
    light: path.join(__filename, '..', '..', '..', 'resources', 'light', 'stubs' + '.svg'),
    dark: path.join(__filename, '..', '..', '..', 'resources', 'dark', 'stubs' + '.svg'),
  };
}
