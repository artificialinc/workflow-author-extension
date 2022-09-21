import * as vscode from 'vscode';
import { ArtificialTreeView } from './artificialTreeView';
import { InsertFunctionCall } from './insertFunctionCall';
export class DropProvider implements vscode.DocumentDropEditProvider {
  private funcTree;
  private assistantTree;

  constructor(
    functionTree: ArtificialTreeView,
    asssistantTree: ArtificialTreeView
  ) {
    this.funcTree = functionTree;
    this.assistantTree = asssistantTree;
  }
  async provideDocumentDropEdits(
    _document: vscode.TextDocument,
    position: vscode.Position,
    dataTransfer: vscode.DataTransfer,
    token: vscode.CancellationToken
  ): Promise<vscode.DocumentDropEdit | undefined> {
    // Check the data transfer to see if we have some kind of text data
    const dataTransferItem =
      dataTransfer.get('text') ?? dataTransfer.get('text/plain');
    if (!dataTransferItem) {
      return undefined;
    }

    let text = await dataTransferItem.asString();
    let element;
    if (text.includes('/python/')) {
      element = this.funcTree.getTreeItemByUri(text);
    }
    if (text.includes('/assistant/')) {
      element = this.assistantTree.getTreeItemByUri(text);
    }
    if (element) {
      const insertFuncCall = new InsertFunctionCall();
      text = insertFuncCall.buildFunctionCall(element.functionSignature);
    }

    if (token.isCancellationRequested) {
      return undefined;
    }

    // Build a snippet to insert
    const snippet = new vscode.SnippetString();
    snippet.appendText(text);

    return { insertText: snippet };
  }
}
