/*
Copyright 2022 Artificial, Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
 limitations under the License.
*/

import * as vscode from 'vscode';
import { AdapterActionTreeView } from '../views/adapterActionTreeView';
import { AssistantByLabTreeView } from '../views/assistantTreeView';
import { InsertFunctionCall } from '../generators/generateFunctionCall';
import { LoadConfigTreeElement, LoadingConfigByLabTreeView } from '../views/loadingConfigView';
export class DropProvider implements vscode.DocumentDropEditProvider {
  private funcTree;
  private assistantTreeByLab;
  private loadConfigTree;
  private context;
  constructor(
    context: vscode.ExtensionContext,
    functionTree: AdapterActionTreeView,
    assistantTreeByLab: AssistantByLabTreeView,
    loadingConfigByLabTreeView: LoadingConfigByLabTreeView,
  ) {
    this.funcTree = functionTree;
    this.assistantTreeByLab = assistantTreeByLab;
    this.loadConfigTree = loadingConfigByLabTreeView;
    this.context = context;
  }
  async provideDocumentDropEdits(
    _document: vscode.TextDocument,
    _position: vscode.Position,
    dataTransfer: vscode.DataTransfer,
    token: vscode.CancellationToken,
  ): Promise<vscode.DocumentDropEdit | undefined> {
    // Check the data transfer to see if we have some kind of text data
    const dataTransferItem = dataTransfer.get('text/uri-list');
    if (!dataTransferItem) {
      return undefined;
    }

    let text = await dataTransferItem.asString();
    let element;
    let className = '';
    let pythonCall = false;
    if (text.includes('/loadConfigs/')) {
      const splitText = text.split('/');
      if (text.includes('/lab/')) {
        text = splitText[splitText.length - 1];
      }
    }
    if (text.includes('/python/')) {
      element = this.funcTree.getTreeItemByUri(text);
      pythonCall = true;
    }
    if (text.includes('/assistant/')) {
      element = this.assistantTreeByLab.getTreeItemByUri(text);
      className = text.split('/')[6];
    }
    if (text.includes('/loadingConfig/')) {
      element = this.loadConfigTree.getTreeItemByUri(text);
      if (element && element instanceof LoadConfigTreeElement && element.configId) {
        text = `${element.configId}`;
      }
    }
    if (element && 'functionSignature' in element) {
      const insertFuncCall = new InsertFunctionCall();
      // TODO: Change parser to put the class name in the function signature
      text = insertFuncCall.buildFunctionCall(element.functionSignature, className, pythonCall);
    }

    if (text.includes('/configs/')) {
      const splitText = text.split('/');
      if (text.includes('/org/')) {
        text = `config_value = get_org_config().configuration['${splitText[splitText.length - 1].replace(
          '%20',
          ' ',
        )}']`;
      } else if (text.includes('/lab/')) {
        text = `config_value = get_lab_config().configuration['${splitText[splitText.length - 1].replace(
          '%20',
          ' ',
        )}']`;
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
