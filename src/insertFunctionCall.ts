import * as vscode from 'vscode';
import { AdapterFunction } from './functionTreeView';
import { FunctionSignature } from './types';

export class InsertFunctionCall {
  insertFunction(node: AdapterFunction): void {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const functionCall = buildFunctionCall(node.functionSignature);
      editor.edit((editBuilder) => {
        editBuilder.insert(editor.selection.active, functionCall);
      });
    }
  }
}
function buildFunctionCall(signature: FunctionSignature): string {
  let content = 'await ' + signature.name + '(\n';

  let functionString = '';
  for (let param of signature.parameters) {
    if (param.name !== 'self' && param.type !== 'ActionContext') {
      functionString += '    ';
      functionString += param.name;
      functionString += '= ,\n';
    }
  }
  content += functionString;
  content += ')';
  return content;
}
