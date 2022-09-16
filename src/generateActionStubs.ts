import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { FunctionSignature } from './types';
import { pathExists } from './utils';
import { buildPythonFunctionSignatures } from './buildFunctionSignatures';

export class GenerateActionStubs {
  constructor(private workspaceRoot: string) {}
  generateStubs(): any {
    let funcSigs: FunctionSignature[] = [];
    const actionPythonPath = path.join(
      this.workspaceRoot,
      'adapter',
      'actions.py'
    );
    if (pathExists(actionPythonPath)) {
      funcSigs = buildPythonFunctionSignatures(actionPythonPath);
    } else {
      vscode.window.showInformationMessage('Workspace has no actions.py');
      return Promise.resolve([]);
    }

    let pythonContent = '# GENERATED FILE: DO NOT EDIT BY HAND\n';
    pythonContent += '# REGEN USING EXTENSION\n';
    pythonContent +=
      'from artificial.workflows.decorators import return_parameter, substrate_action\n\n';

    for (const sig of funcSigs) {
      pythonContent = pythonContent.concat('\n');
      pythonContent = pythonContent.concat(
        "@substrate_action('",
        sig.name,
        '\', display_name="',
        sig.name,
        '")'
      );
      pythonContent = pythonContent.concat('\n');
      pythonContent = pythonContent.concat('@return_parameter("TODO")\n');
      // TODO: loop keywords here, this is assuming always async def
      let functionString =
        sig.keywords[0] + ' ' + sig.keywords[1] + ' ' + sig.name + '(';
      let iterations = sig.parameters.length;
      for (let param of sig.parameters) {
        --iterations;
        if (param.name !== 'self' && param.type !== 'ActionContext') {
          functionString += param.name;
          functionString += ': ';
          functionString += param.type;
          // This takes care of trailing comma after last param
          if (iterations) {
            functionString += ', ';
          }
        }
      }

      functionString += ')';
      if (sig.returnType !== '') {
        functionString += ' -> ';
        functionString += sig.returnType;
      }
      functionString += ':';
      pythonContent = pythonContent.concat(functionString);
      pythonContent = pythonContent.concat('\n');
      pythonContent = pythonContent.concat('    pass\n\n');
    }

    fs.writeFile(
      path.join(this.workspaceRoot, 'workflow', 'stubs_actions.py'),
      pythonContent,
      (err) => {
        if (err) {
          return vscode.window.showErrorMessage(
            'Failed to create boilerplate file!'
          );
        }
        vscode.window.showInformationMessage('Created boilerplate files');
      }
    );
  }
}
