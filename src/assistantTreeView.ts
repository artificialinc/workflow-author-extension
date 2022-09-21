import * as vscode from 'vscode';
import * as path from 'path';
import { ArtificialApollo } from './apollo';
import { FunctionSignature } from './types';

interface AssistantResponse {
  assistants: [{ name: string }];
}

export class AssistantTreeView
  implements
    vscode.TreeDataProvider<Assistant>,
    vscode.TreeDragAndDropController<Assistant>
{
  dropMimeTypes = ['application/vnd.code.tree.stubs'];
  dragMimeTypes = ['text/uri-list'];
  constructor(context: vscode.ExtensionContext) {
    const view = vscode.window.createTreeView('assistants', {
      treeDataProvider: this,
      showCollapseAll: false,
      canSelectMany: false,
      dragAndDropController: this,
    });
    context.subscriptions.push(view);
  }
  public async handleDrag(
    source: Assistant[],
    treeDataTransfer: vscode.DataTransfer,
    token: vscode.CancellationToken
  ): Promise<void> {
    // treeDataTransfer.set(
    //   'application/vnd.code.tree.stubs',
    //   new vscode.DataTransferItem(source)
    // );
    //treeDataTransfer.set('text/plain', new vscode.DataTransferItem('thing'));
  }
  getTreeItem(element: Assistant): vscode.TreeItem {
    return element;
  }

  getTreeItemByUri(uri: string): Assistant | undefined {
    const element = this.treeElements.find((sig) => {
      if (sig.resourceUri.toString() === 'file://' + uri) {
        return sig;
      }
    });
    return element;
  }
  private treeElements!: Assistant[];
  async getChildren(element?: Assistant): Promise<Assistant[]> {
    if (element) {
      return [];
    } else {
      this.treeElements = await this.getAssistants();
      return await this.treeElements;
    }
  }

  private async getAssistants(): Promise<Assistant[]> {
    const client = ArtificialApollo.getInstance();
    const response: AssistantResponse = await client.queryAssistants();

    const assistants = response.assistants.map((assistant): Assistant => {
      return new Assistant(
        assistant.name,
        vscode.TreeItemCollapsibleState.None,
        {
          keywords: [],
          name: 'test',
          parameters: [],
          returnType: 'return',
        }
      );
    });

    return assistants;
  }
}

export class Assistant extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly functionSignature: FunctionSignature
  ) {
    super(label, collapsibleState);
    this.tooltip = `${this.label}`;
    this.functionSignature = functionSignature;
  }
  resourceUri = vscode.Uri.parse('artificial/assistant/' + this.label);
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
