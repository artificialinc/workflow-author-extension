import * as vscode from 'vscode';
import * as path from 'path';
import { ArtificialApollo, AssistantReply, Assistant } from './apollo';
import { BuildAssistantSignatures, AssistantSignature } from './buildAssistantSignatures';
import { LabTreeElement } from './loadConfigTreeView';
import * as _ from 'lodash';

type TreeElement = LabTreeElement | AssistantTreeElement;
export class AssistantByLabTreeView
  implements vscode.TreeDataProvider<TreeElement>, vscode.TreeDragAndDropController<TreeElement>
{
  dropMimeTypes = ['application/vnd.code.tree.stubs'];
  dragMimeTypes = ['text/uri-list'];

  private _onDidChangeTreeData: vscode.EventEmitter<TreeElement | undefined | void> = new vscode.EventEmitter<
    TreeElement | undefined | void
  >();
  private assistantResponse!: AssistantReply | undefined;
  private assistantSignatures!: AssistantSignature[];
  readonly onDidChangeTreeData: vscode.Event<TreeElement | undefined | void> = this._onDidChangeTreeData.event;

  constructor(private stubPath: string, private uriPath: string, context: vscode.ExtensionContext) {
    const view = vscode.window.createTreeView('assistantsByLab', {
      treeDataProvider: this,
      showCollapseAll: true,
      canSelectMany: true,
      dragAndDropController: this,
    });
    context.subscriptions.push(view);
    this.treeElements = [];
  }

  public async init(): Promise<void> {
    const client = ArtificialApollo.getInstance();
    this.assistantResponse = await client.queryAssistants();
    this.assistantSignatures = new BuildAssistantSignatures().build(this.stubPath);
    this.treeElements = await this.getChildren();
    return;
  }

  async refresh(): Promise<void> {
    this.treeElements = [];
    const client = ArtificialApollo.getInstance();
    this.assistantResponse = await client.queryAssistants();
    this.assistantSignatures = new BuildAssistantSignatures().build(this.stubPath);
    this.treeElements = await this.getChildren();
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
        const assistants = await this.getAssistants(element);
        this.treeElements = this.treeElements.concat(assistants);
        return assistants;
      }
      return [];
    } else {
      const labs = await this.getLabs();
      for (let x = labs.length - 1; x >= 0; x--) {
        const assistants = await this.getAssistants({ label: labs[x].label, labId: labs[x].labId });
        if (assistants.length === 0) {
          labs.splice(x, 1);
        }
      }
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
      return new LabTreeElement(lab.name, lab.id, this.uriPath, 'lab');
    });
    labs.push(new LabTreeElement('UNKNOWN', '', this.uriPath, 'lab'));
    return labs;
  }

  private async getAssistants(element: { label: string; labId: string }): Promise<AssistantTreeElement[]> {
    //const client = ArtificialApollo.getInstance();
    const response = this.assistantResponse; //await client.queryAssistants();
    if (!response) {
      return [];
    }
    const treeElements: AssistantTreeElement[] = [];
    const functionSignatures = this.assistantSignatures; //new BuildAssistantSignatures().build(this.stubPath);
    // Find the matching assistant ID from stubs to apollo
    for (const sig of functionSignatures) {
      const found = response.assistants.find((ele) => ele.id === sig.actionId);
      if (found) {
        if (found.constraint.labId === element.labId) {
          if (this.validParams(sig, found)) {
            treeElements.push(new AssistantTreeElement(sig.name, element.labId, this.uriPath, 'assistant', sig));
          } else {
            treeElements.push(new AssistantTreeElementError(sig.name, element.labId, this.uriPath, 'assistant', sig));
          }
        }
      } else if (element.label === 'UNKNOWN') {
        treeElements.push(new AssistantTreeElementError(sig.name, element.labId, this.uriPath, 'assistant', sig));
      }
    }
    return treeElements;
  }

  private validParams(stubSignature: AssistantSignature, assistant: Assistant): boolean {
    const stubNames: string[] = [];
    const assistantParamNames: string[] = [];
    for (const param of stubSignature.parameters) {
      stubNames.push(param.assistantName);
    }
    for (const param of assistant.parameters) {
      assistantParamNames.push(param.typeInfo.name);
    }
    const diff = _.difference(stubNames, assistantParamNames);
    const alabDiff = _.difference(assistantParamNames, stubNames);
    if (diff.length > 0 || alabDiff.length > 0) {
      return false;
    }
    return true;
  }
}

export class AssistantTreeElement extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly labId: string,
    public readonly uriPath: string,
    public readonly type: string,
    public readonly functionSignature: AssistantSignature
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.tooltip = `${this.label}`;
    this.functionSignature = functionSignature;
    this.contextValue = 'ASSISTANT';
  }
  resourceUri = vscode.Uri.parse(this.uriPath + 'assistant/' + this.label);

  iconPath = {
    light: path.join(__filename, '..', '..', 'resources', 'light', 'assistants.svg'),
    dark: path.join(__filename, '..', '..', 'resources', 'dark', 'assistants.svg'),
  };
}
export class AssistantTreeElementError extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly labId: string,
    public readonly uriPath: string,
    public readonly type: string,
    public readonly functionSignature: AssistantSignature
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.tooltip = `Assistant stub does not match to any lab in Artificial`;
    this.functionSignature = functionSignature;
    this.contextValue = 'ASSISTANT';
  }
  resourceUri = vscode.Uri.parse(this.uriPath + 'assistant/' + this.functionSignature.name);

  iconPath = {
    light: path.join(__filename, '..', '..', 'resources', 'light', 'warn.svg'),
    dark: path.join(__filename, '..', '..', 'resources', 'dark', 'warn.svg'),
  };
}
