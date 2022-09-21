import * as vscode from 'vscode';
import * as path from 'path';
import { ArtificialApollo } from './apollo';

interface AssistantResponse {
  assistants: [{ name: string }];
}

export class AssistantTreeView implements vscode.TreeDataProvider<Assistant> {
  constructor(context: vscode.ExtensionContext) {
    const view = vscode.window.createTreeView('assistants', {
      treeDataProvider: this,
      showCollapseAll: false,
      canSelectMany: false,
    });
    context.subscriptions.push(view);
  }

  getTreeItem(element: Assistant): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: Assistant): Promise<Assistant[]> {
    if (element) {
      return [];
    } else {
      return await this.getAssistants();
    }
  }

  private async getAssistants(): Promise<Assistant[]> {
    const client = ArtificialApollo.getInstance();
    const response: AssistantResponse = await client.queryAssistants();

    const assistants = response.assistants.map((assistant): Assistant => {
      return new Assistant(
        assistant.name,
        vscode.TreeItemCollapsibleState.None
      );
    });

    return assistants;
  }
}

export class Assistant extends vscode.TreeItem {
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
