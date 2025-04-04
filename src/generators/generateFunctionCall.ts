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
import { ArtificialFunction } from '../views/adapterActionTreeView';

export class InsertFunctionCall {
  insertFunction(node: ArtificialFunction): void {
    const editor = vscode.window.activeTextEditor;
    let className = '';
    let pythonCall = true;
    if (editor) {
      if (node.resourceUri.toString().includes('/assistant/')) {
        className = node.resourceUri.toString().split('/')[6];
        pythonCall = false;
      }
      const functionCall = this.buildFunctionCall(node.functionSignature, className, pythonCall);
      editor.edit((editBuilder) => {
        editBuilder.insert(editor.selection.active, functionCall);
      });
    }
  }
  buildFunctionCall(
    signature: FunctionSignature | AssistantSignature,
    className: string,
    _pythonCall: boolean,
  ): string {
    let content = '';
    if (className !== '') {
      content += 'await ' + className + '.' + signature.name + '(\n';
    } else {
      content += 'await ' + signature.name + '(\n';
    }

    let functionString = '';
    for (const param of signature.parameters) {
      if (param.name !== 'self' && param.type !== 'ActionContext') {
        functionString += '\t\t';
        functionString += param.name;
        functionString += '= ,\n';
      }
    }
    content += functionString;
    content += '\t)';
    return content;
  }
}
