import * as vscode from 'vscode';
import { PythonTreeView } from '../views/pythonTreeView';
import { AssistantByLabTreeView, AssistantTreeElement } from '../views/assistantTreeView';
import { InsertFunctionCall } from '../generators/generateFunctionCall';
export class DropProvider implements vscode.DocumentDropEditProvider {
  private funcTree;
  private assistantTreeByLab;
  constructor(functionTree: PythonTreeView, assistantTreeByLab: AssistantByLabTreeView) {
    this.funcTree = functionTree;
    this.assistantTreeByLab = assistantTreeByLab;
  }
  async provideDocumentDropEdits(
    _document: vscode.TextDocument,
    position: vscode.Position,
    dataTransfer: vscode.DataTransfer,
    token: vscode.CancellationToken
  ): Promise<vscode.DocumentDropEdit | undefined> {
    // Check the data transfer to see if we have some kind of text data
    const dataTransferItem = dataTransfer.get('text') ?? dataTransfer.get('text/plain');
    if (!dataTransferItem) {
      return undefined;
    }

    let text = await dataTransferItem.asString();
    let element;
    if (text.includes('/python/')) {
      element = this.funcTree.getTreeItemByUri(text);
    }
    if (text.includes('/assistant/')) {
      element = this.assistantTreeByLab.getTreeItemByUri(text);
    }
    if (element && 'functionSignature' in element) {
      const insertFuncCall = new InsertFunctionCall();
      text = insertFuncCall.buildFunctionCall(element.functionSignature);
    }

    // TODO: Move this into tree provider or own generator??
    if (text.includes('/loadConfigs/')) {
      const splitText = text.split('/');
      if (text.includes('/lab/')) {
        text = splitText[splitText.length - 1];
      } else if (text.includes('/asset/')) {
        const loadConfigId = splitText[splitText.length - 2];
        const loadConfigOrder = splitText[splitText.length - 1];
        text = `assets = await load_assets(start_idx=${
          parseFloat(loadConfigOrder) + 1
        }, number_to_load = 1, '${loadConfigId}')`;
      } else {
        const loadConfigId = splitText[splitText.length - 1];
        text = `assets = await load_assets(start_idx= , number_to_load = , '${loadConfigId}')`;
      }
    }
    if (text.includes('/configs/')) {
      const splitText = text.split('/');
      if (text.includes('/org/')) {
        text = `config_value = get_org_config().configuration['${splitText[splitText.length - 1]}']`;
      } else if (text.includes('/lab/')) {
        text = `config_value = get_lab_config().configuration['${splitText[splitText.length - 1]}']`;
      }
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
