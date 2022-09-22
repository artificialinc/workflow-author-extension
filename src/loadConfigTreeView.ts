import * as vscode from 'vscode';
import * as path from 'path';
import { ArtificialApollo } from './apollo';
interface LabReply {
  labs: [{ name: string; id: string }];
}
interface ConfigReply {
  lab: { assets: [{ loadingConfigId: string }] };
}
export class LoadConfigTreeView
  implements
    vscode.TreeDataProvider<LoadConfigTreeElement>,
    vscode.TreeDragAndDropController<LoadConfigTreeElement>
{
  dropMimeTypes = ['application/vnd.code.tree.stubs'];
  dragMimeTypes = ['text/uri-list'];

  private _onDidChangeTreeData: vscode.EventEmitter<
    LoadConfigTreeElement | undefined | void
  > = new vscode.EventEmitter<LoadConfigTreeElement | undefined | void>();

  readonly onDidChangeTreeData: vscode.Event<
    LoadConfigTreeElement | undefined | void
  > = this._onDidChangeTreeData.event;

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
  }

  public async init(): Promise<void> {
    // TODO: This needs to also collect children as they are discovered
    // Right now it just holds on to all parent tree items
    this.treeElements = await this.getChildren();
    return;
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }
  public async handleDrag(
    source: LoadConfigTreeElement[],
    treeDataTransfer: vscode.DataTransfer,
    token: vscode.CancellationToken
  ): Promise<void> {}

  getTreeItem(element: LoadConfigTreeElement): vscode.TreeItem {
    return element;
  }
  getTreeItemByUri(uri: string): LoadConfigTreeElement | undefined {
    const element = this.treeElements.find((sig) => {
      if (sig.resourceUri.toString() === 'file://' + uri) {
        return sig;
      }
    });
    return element;
  }

  private treeElements!: LoadConfigTreeElement[];
  async getChildren(
    element?: LoadConfigTreeElement
  ): Promise<LoadConfigTreeElement[]> {
    if (element) {
      return await this.getConfigs(element.labId);
    } else {
      this.treeElements = await this.getLabs();
      return this.treeElements;
    }
  }

  private async getLabs(): Promise<LoadConfigTreeElement[]> {
    const client = ArtificialApollo.getInstance();
    const response: LabReply = await client.queryLabs();
    const labs = response.labs.map((lab): LoadConfigTreeElement => {
      return new LoadConfigTreeElement(
        lab.name,
        vscode.TreeItemCollapsibleState.Collapsed,
        lab.id,
        this.uriPath,
        this.vscodeID
      );
    });

    return labs;
  }
  private async getConfigs(element: string): Promise<LoadConfigTreeElement[]> {
    const client = ArtificialApollo.getInstance();
    const response: ConfigReply = await client.queryConfigs(element);
    const configs: LoadConfigTreeElement[] = [];
    for (const asset of response.lab.assets) {
      if (
        asset.loadingConfigId !== '' &&
        !configs.some((ele) => ele.label === asset.loadingConfigId)
      ) {
        configs.push(
          new LoadConfigTreeElement(
            asset.loadingConfigId,
            vscode.TreeItemCollapsibleState.None,
            '',
            this.uriPath,
            this.vscodeID
          )
        );
      }
    }

    return configs;
  }
}

export class LoadConfigTreeElement extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly labId: string,
    public readonly uriPath: string,
    public readonly icon: string
  ) {
    super(label, collapsibleState);
    this.tooltip = `${this.label}`;
    this.labId = labId;
    this.uriPath = uriPath;
    this.icon = icon;
  }
  resourceUri = vscode.Uri.parse(this.uriPath + this.label);

  iconPath = {
    light: path.join(
      __filename,
      '..',
      '..',
      'resources',
      'light',
      this.icon + '.svg'
    ),
    dark: path.join(
      __filename,
      '..',
      '..',
      'resources',
      'dark',
      this.icon + '.svg'
    ),
  };
}
