import * as vscode from 'vscode';
import * as path from 'path';
import { ArtificialApollo } from '../providers/apolloProvider';

type TreeItem = OrgTreeItem | ConfigTreeItem;

export class ConfigTreeView implements vscode.TreeDataProvider<TreeItem>, vscode.TreeDragAndDropController<TreeItem> {
  dropMimeTypes = ['application/vnd.code.tree.stubs'];
  dragMimeTypes = ['text/uri-list'];

  private _onDidChangeTreeData: vscode.EventEmitter<TreeItem | undefined | void> = new vscode.EventEmitter<
    TreeItem | undefined | void
  >();

  readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined | void> = this._onDidChangeTreeData.event;
  private uriPath: string;
  constructor(context: vscode.ExtensionContext) {
    const view = vscode.window.createTreeView('configs', {
      treeDataProvider: this,
      showCollapseAll: false,
      canSelectMany: false,
      dragAndDropController: this,
    });
    context.subscriptions.push(view);
    this.uriPath = 'artificial/configs/';
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }
  public async handleDrag(
    source: TreeItem[],
    treeDataTransfer: vscode.DataTransfer,
    token: vscode.CancellationToken
  ): Promise<void> {}

  getTreeItem(element: TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: TreeItem): Promise<TreeItem[]> {
    if (element) {
      if (element.type === 'org') {
        const apolloClient = ArtificialApollo.getInstance();

        const orgConfigResponse = await apolloClient.queryOrgConfig();
        const parsed = JSON.parse(orgConfigResponse?.getCurrentOrgConfiguration.configValuesDocument ?? '');
        const items: ConfigTreeItem[] = [];
        Object.entries(parsed.configuration).forEach((entry) => {
          const [key, value] = entry;
          if (typeof value === 'string' && value !== null) {
            items.push(new ConfigTreeItem(key, value, vscode.TreeItemCollapsibleState.None));
          }
        });
        return items;
      }
      return [];
    } else {
      return [new OrgTreeItem('Artificial')];
    }
  }
}

export class OrgTreeItem extends vscode.TreeItem {
  readonly type: string;
  constructor(public readonly label: string) {
    super(label, vscode.TreeItemCollapsibleState.Collapsed);
    this.tooltip = `${this.label}`;
    this.type = 'org';
  }
  resourceUri = vscode.Uri.parse('artificial/configs/' + this.label);

  iconPath = new vscode.ThemeIcon('organization');
}

export class ConfigTreeItem extends vscode.TreeItem {
  readonly type: string;
  constructor(
    public readonly label: string,
    public readonly description: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsibleState);
    this.tooltip = `${this.label}`;
    this.type = 'config';
  }
  resourceUri = vscode.Uri.parse('artificial/configs/' + this.label);

  iconPath = new vscode.ThemeIcon('symbol-property');
}
