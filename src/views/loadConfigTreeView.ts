import * as vscode from 'vscode';
import * as path from 'path';
import { ArtificialApollo } from '../providers/apolloProvider';

type TreeElement = LoadConfigTreeElement | LabTreeElement | AssetTreeElement;
export class LoadConfigTreeView
  implements vscode.TreeDataProvider<TreeElement>, vscode.TreeDragAndDropController<TreeElement>
{
  dropMimeTypes = ['application/vnd.code.tree.loadConfigs'];
  dragMimeTypes = ['text/uri-list'];

  private _onDidChangeTreeData: vscode.EventEmitter<TreeElement | undefined | void> = new vscode.EventEmitter<
    TreeElement | undefined | void
  >();

  readonly onDidChangeTreeData: vscode.Event<TreeElement | undefined | void> = this._onDidChangeTreeData.event;

  constructor(private stubPath: string, context: vscode.ExtensionContext) {
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
    this.treeElements = await this.getChildren();
    return;
  }

  refresh(): void {
    this.treeElements = [];
    this._onDidChangeTreeData.fire();
  }

  public async handleDrag(
    source: TreeElement[],
    treeDataTransfer: vscode.DataTransfer,
    token: vscode.CancellationToken
  ): Promise<void> {}

  getTreeItem(element: TreeElement): vscode.TreeItem {
    return element;
  }

  getTreeItemByUri(uri: string): TreeElement | undefined {
    const element = this.treeElements.find((sig) => {
      if (sig.resourceUri.toString() === 'file://' + uri) {
        return sig;
      }
    });
    return element;
  }

  private treeElements!: TreeElement[];
  async getChildren(element?: TreeElement): Promise<TreeElement[]> {
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

  private async getLabs(): Promise<LabTreeElement[]> {
    const client = ArtificialApollo.getInstance();
    const response = await client.queryLabs();
    if (!response) {
      return [];
    }
    const labs = response.labs.map((lab): LabTreeElement => {
      return new LabTreeElement(lab.name, lab.id);
    });

    return labs;
  }

  private async getConfigs(element: string): Promise<LoadConfigTreeElement[]> {
    const client = ArtificialApollo.getInstance();
    const response = await client.queryConfigs(element);
    if (!response) {
      return [];
    }
    const configs: LoadConfigTreeElement[] = [];
    for (const asset of response.lab.assets) {
      if (asset.loadingConfigId !== '' && !configs.some((ele) => ele.label === asset.loadingConfigId)) {
        configs.push(new LoadConfigTreeElement(asset.loadingConfigId, asset.labId));
      }
    }

    return configs;
  }

  private async getAssets(element: LoadConfigTreeElement): Promise<AssetTreeElement[]> {
    const client = ArtificialApollo.getInstance();
    const response = await client.queryConfigs(element.labId);
    if (!response) {
      return [];
    }
    const assets = [];
    for (const asset of response.lab.assets) {
      if (asset.loadingConfigId === element.label) {
        assets.push(asset);
      }
    }
    assets.sort((first, second) => 0 - (first.loadingConfigOrder < second.loadingConfigOrder ? 1 : -1));
    const orderedAssets: AssetTreeElement[] = [];
    for (const asset of assets) {
      orderedAssets.push(
        new AssetTreeElement(asset.name, asset.labId, asset.id, asset.loadingConfigId, asset.loadingConfigOrder)
      );
    }

    return orderedAssets;
  }
}

export class LoadConfigTreeElement extends vscode.TreeItem {
  constructor(public readonly label: string, public readonly labId: string) {
    super(label, vscode.TreeItemCollapsibleState.Collapsed);
    this.tooltip = `${this.label}`;
  }
  resourceUri = vscode.Uri.parse('artificial/loadConfigs/' + this.label);
  type = 'loadConfig';
  iconPath = {
    light: path.join(__filename, '..', '..', '..', 'resources', 'light', 'loadConfigs.svg'),
    dark: path.join(__filename, '..', '..', '..', 'resources', 'dark', 'loadConfigs.svg'),
  };
}

export class LabTreeElement extends vscode.TreeItem {
  constructor(public readonly label: string, public readonly labId: string) {
    super(label, vscode.TreeItemCollapsibleState.Collapsed);
    this.tooltip = `${this.label}`;
  }
  resourceUri = vscode.Uri.parse('artificial/loadConfigs/' + 'lab/' + this.labId);
  type = 'lab';
  iconPath = {
    light: path.join(__filename, '..', '..', '..', 'resources', 'light', 'labs.svg'),
    dark: path.join(__filename, '..', '..', '..', 'resources', 'dark', 'labs.svg'),
  };
}

export class AssetTreeElement extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly labId: string,
    public readonly assetId: string,
    public readonly loadConfigId: string,
    public readonly loadConfigOrder: number
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.tooltip = `${this.label}`;
  }
  resourceUri = vscode.Uri.parse('artificial/loadConfigs/' + 'asset/' + this.loadConfigId + '/' + this.loadConfigOrder);
  type = 'asset';
  iconPath = {
    light: path.join(__filename, '..', '..', '..', 'resources', 'light', 'assets.svg'),
    dark: path.join(__filename, '..', '..', '..', 'resources', 'dark', 'assets.svg'),
  };
}
