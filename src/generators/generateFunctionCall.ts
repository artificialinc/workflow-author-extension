import * as vscode from 'vscode';
import { Function } from '../views/pythonTreeView';
import { AssistantSignature } from '../parsers/parseAssistantSignatures';
import { FunctionSignature } from '../apis/types';

export class InsertFunctionCall {
  insertFunction(node: Function): void {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const functionCall = this.buildFunctionCall(node.functionSignature);
      editor.edit((editBuilder) => {
        editBuilder.insert(editor.selection.active, functionCall);
      });
    }
  }
  buildFunctionCall(signature: FunctionSignature | AssistantSignature): string {
    let content = 'await ' + signature.name + '(\n';

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
