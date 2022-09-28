import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { FunctionSignature } from './types';
import { pathExists } from './utils';
import { BuildFunctionSignatures } from './buildFunctionSignatures';
import { ArtificialApollo, Assistant, AssistantTypeInfo } from './apollo';
import { OutputLog } from './outputLog';
import { snakeCase } from 'lodash';
import { type } from 'os';

export class GenerateActionStubs {
  outputChannel = OutputLog.getInstance();
  constructor(private workspaceRoot: string) {}
  async generateStubs(): Promise<any> {
    this.generatePythonStubs();
    await this.generateAssistantStubs();
  }

  private async generateAssistantStubs(): Promise<void> {
    const client = ArtificialApollo.getInstance();
    const response = await client.queryAssistants();
    this.outputChannel.log(JSON.stringify(response));

    let pythonContent = '# GENERATED FILE: DO NOT EDIT BY HAND\n';
    pythonContent += '# REGEN USING EXTENSION\n';
    pythonContent += 'from typing import List\n\n';
    pythonContent += 'from artificial.workflows.decorators import assistant, parameter\n\n';
    if (!response?.assistants) {
      return;
    }
    for (const sig of response?.assistants) {
      pythonContent += `@assistant('${sig.id}')\n`;
      pythonContent += this.buildAssistantParmDec(sig);
      pythonContent += `async def assistant_${snakeCase(sig.name)}(\n`;
      pythonContent += this.buildAssistantParams(sig);
      pythonContent += `) -> None:\n`;
      pythonContent += `\tpass\n\n`;
    }

    fs.writeFile(path.join(this.workspaceRoot, 'workflow', 'stubs_assistants.py'), pythonContent, (err) => {
      if (err) {
        return vscode.window.showErrorMessage('Failed to create boilerplate file!');
      }
      vscode.window.showInformationMessage('Created boilerplate files');
    });
  }

  private buildAssistantParams(sig: Assistant): string {
    let returnString = '';
    for (const parm of sig.parameters) {
      returnString += `\targ_${snakeCase(parm.typeInfo.name)}: ${this.convertToPythonType(parm.typeInfo)},\n`;
    }
    return returnString;
  }

  private convertToPythonType(type: AssistantTypeInfo | { type: string }): string {
    let returnString = '';
    if (type.type === 'ARRAY') {
      if ('subTypes' in type) {
        returnString += `List[${this.convertToPythonType(type.subTypes[0])}]`;
      }
    } else {
      switch (type.type) {
        case 'INT':
          returnString += 'int';
          break;
        case 'FLOAT':
          returnString += 'float';
          break;
        case 'BOOLEAN':
          returnString += 'bool';
          break;
        case 'STRING':
          returnString += 'str';
          break;
        case 'EQUIPMENT_REF':
          returnString += 'str';
          break;
      }
    }
    return returnString;
  }

  private buildAssistantParmDec(sig: Assistant): string {
    let returnString = '';
    for (const parm of sig.parameters) {
      returnString += `@parameter('arg_${snakeCase(parm.typeInfo.name)}', action_parameter_name='${
        parm.typeInfo.name
      }')\n`;
    }
    return returnString;
  }

  private generatePythonStubs(): void {
    let funcSigs: FunctionSignature[] = [];
    const actionPythonPath = path.join(this.workspaceRoot, 'adapter', 'actions.py');
    if (pathExists(actionPythonPath)) {
      funcSigs = new BuildFunctionSignatures().build(actionPythonPath);
    } else {
      vscode.window.showInformationMessage('Workspace has no actions.py');
      return;
    }

    let pythonContent = '# GENERATED FILE: DO NOT EDIT BY HAND\n';
    pythonContent += '# REGEN USING EXTENSION\n';
    pythonContent += 'from artificial.workflows.decorators import substrate_action\n\n';

    for (const sig of funcSigs) {
      pythonContent = pythonContent.concat('\n');
      pythonContent = pythonContent.concat("@substrate_action('", sig.name, '\', display_name="', sig.name, '")');
      pythonContent = pythonContent.concat('\n');
      // TODO: loop keywords here, this is assuming always async def
      let functionString = sig.keywords[0] + ' ' + sig.keywords[1] + ' ' + sig.name + '(';
      let iterations = sig.parameters.length;
      for (let param of sig.parameters) {
        --iterations;
        if (param.name !== 'self' && param.type !== 'ActionContext' && !param.name.includes('ioraw_')) {
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

    fs.writeFile(path.join(this.workspaceRoot, 'workflow', 'stubs_actions.py'), pythonContent, (err) => {
      if (err) {
        return vscode.window.showErrorMessage('Failed to create boilerplate file!');
      }
      vscode.window.showInformationMessage('Created boilerplate files');
    });
  }
}

// let terminal = vscode.window.activeTerminal;
// if (!terminal) {
//   terminal = vscode.window.createTerminal(`Ext Terminal`);
// }
// terminal.sendText('cd workflow');
// terminal.sendText('ls');
