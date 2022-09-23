import * as vscode from 'vscode';
import * as path from 'path';
import { ArtificialApollo } from './apollo';
interface LabReply {
  labs: [{ name: string; id: string }];
}
interface ConfigReply {
  lab: {
    assets: [
      {
        loadingConfigId: string;
        loadingConfigOrder: number;
        labId: string;
        name: string;
      }
    ];
  };
}
interface Asset {
  name: string;
  collapse: vscode.TreeItemCollapsibleState;
  labId: string;
  uri: string;
  icon: string;
  type: string;
  order: number;
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
    context: vscode.ExtensionContext
  ) {
    const view = vscode.window.createTreeView('loadConfigs', {
      treeDataProvider: this,
      showCollapseAll: true,
      canSelectMany: true,
      dragAndDropController: this,
    });
    context.subscriptions.push(view);
    this.treeElements = [];
  }

  public async init(): Promise<void> {
    // TODO: This needs to also collect children as they are discovered
    // Right now it just holds on to all parent tree items
    this.treeElements = await this.getChildren();
    return;
  }

  refresh(): void {
    this.treeElements = [];
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
      if (element.type === 'lab') {
        const loadconfigs = await this.getConfigs(element.labId);
        this.treeElements = this.treeElements.concat(loadconfigs);
        return loadconfigs;
      } else if (element.type === 'loadConfig') {
        const assets = await this.getAssets(element);
        this.treeElements = this.treeElements.concat(assets);
        return assets;
      }
      return [];
    } else {
      const labs = await this.getLabs();
      this.treeElements = this.treeElements.concat(labs);
      return labs;
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
        'labs',
        'lab'
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
            vscode.TreeItemCollapsibleState.Collapsed,
            asset.labId,
            this.uriPath,
            'loadConfigs',
            'loadConfig'
          )
        );
      }
    }

    return configs;
  }
  private async getAssets(
    element: LoadConfigTreeElement
  ): Promise<LoadConfigTreeElement[]> {
    const client = ArtificialApollo.getInstance();
    const response: ConfigReply = await client.queryConfigs(element.labId);
    const assets: Asset[] = [];
    for (const asset of response.lab.assets) {
      if (asset.loadingConfigId === element.label) {
        assets.push({
          name: asset.name,
          collapse: vscode.TreeItemCollapsibleState.None,
          labId: asset.labId,
          uri: this.uriPath,
          icon: 'assets',
          type: 'asset',
          order: asset.loadingConfigOrder,
        });
      }
    }
    assets.sort((first, second) => 0 - (first.order < second.order ? 1 : -1));
    const orderedAssets: LoadConfigTreeElement[] = [];
    for (const asset of assets) {
      orderedAssets.push(
        new LoadConfigTreeElement(
          asset.name,
          asset.collapse,
          asset.labId,
          asset.uri,
          asset.icon,
          asset.type
        )
      );
    }

    return orderedAssets;
  }
}

export class LoadConfigTreeElement extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly labId: string,
    public readonly uriPath: string,
    public readonly icon: string,
    public readonly type: string
  ) {
    super(label, collapsibleState);
    this.tooltip = `${this.label}`;
    this.labId = labId;
    this.uriPath = uriPath;
    this.icon = icon;
    this.type = type;
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
