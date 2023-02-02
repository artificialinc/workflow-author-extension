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
import { Function } from '../views/pythonTreeView';

export class InsertFunctionCall {
  insertFunction(node: Function): void {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const functionCall = this.buildFunctionCall(node.functionSignature, '');
      editor.edit((editBuilder) => {
        editBuilder.insert(editor.selection.active, functionCall);
      });
    }
  }
  buildFunctionCall(signature: FunctionSignature | AssistantSignature, className: string): string {
    let content = '';
    if (className !== '') {
      content = 'await ' + className + '.' + signature.name + '(\n';
    } else {
      content = 'await ' + signature.name + '(\n';
    }

    let functionString = '';
    for (let param of signature.parameters) {
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
