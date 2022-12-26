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
import * as fs from 'fs';
import * as path from 'path';
import { FunctionSignature } from '../apis/types';
import { pathExists } from '../utils';
import { ArtificialApollo, Assistant, AssistantTypeInfo } from '../providers/apolloProvider';
import { OutputLog } from '../providers/outputLogProvider';
import { snakeCase } from 'lodash';
import { BuildPythonSignatures } from '../parsers/parsePythonSignatures';
import { AssistantByLabTreeView } from '../views/assistantTreeView';
import { AssistantSignature, BuildAssistantSignatures } from '../parsers/parseAssistantSignatures';
import * as _ from 'lodash';

export class GenerateActionStubs {
  outputChannel = OutputLog.getInstance();
  constructor(private workspaceRoot: string, private assistantByLab: AssistantByLabTreeView) {}
  async generateStubs(): Promise<any> {
    this.generatePythonStubs();
    await this.generateAssistantStubs();
    await this.assistantByLab.refresh();
    vscode.window.showInformationMessage('Created boilerplate files');
  }

  private async generateAssistantStubs(): Promise<void> {
    const client = ArtificialApollo.getInstance();
    const response = await client.queryAssistants();
    const customAssistantStubPath = vscode.workspace.getConfiguration('artificial.workflow.author').assistantStubPath;
    const fullPath = path.join(this.workspaceRoot, customAssistantStubPath);
    const stubs = new BuildAssistantSignatures().build(fullPath);

    let pythonContent = '# GENERATED FILE: DO NOT EDIT BY HAND\n';
    pythonContent += '# REGEN USING EXTENSION\n';
    pythonContent += '# flake8: noqa\n';
    pythonContent += 'from typing import List\n\n';
    pythonContent += 'from artificial.workflows.decorators import assistant, parameter\n\n\n';
    if (!response?.assistants) {
      return;
    }

    for (const sig of response?.assistants) {
      let allParamsSorted = this.getAllParamsSorted(sig, stubs);
      pythonContent += `@assistant('${sig.id}')\n`;
      pythonContent += this.buildAssistantParmDec(sig, allParamsSorted);
      pythonContent += `async def assistant_${snakeCase(sig.name)}(\n`;
      pythonContent += this.buildAssistantParams(sig, allParamsSorted);
      pythonContent += `) -> None:\n`;
      pythonContent += `    pass\n\n\n`;
    }

    fs.writeFile(fullPath, pythonContent, (err) => {
      if (err) {
        return vscode.window.showErrorMessage('Failed to create boilerplate file!');
      }
    });
  }

  private getAllParamsSorted(apolloSignature: Assistant, stubs: AssistantSignature[]): string[] {
    let allParamsSorted: string[] = [];

    let stubParams = [];
    let alabParams = [];
    if (stubs) {
      const stubSignature = stubs.find((element) => element.actionId === apolloSignature.id);
      if (stubSignature) {
        for (let param of stubSignature?.parameters) {
          stubParams.push(param.assistantName);
        }
      }
      for (let param of apolloSignature.parameters) {
        alabParams.push(param.typeInfo.name);
      }
      const sortedParams = _.intersection(stubParams, alabParams);
      allParamsSorted = _.concat(sortedParams, _.difference(alabParams, sortedParams));
    }

    return allParamsSorted;
  }

  private buildAssistantParams(sig: Assistant, allParamsSorted: string[]): string {
    let returnString = '';

    for (const param of allParamsSorted) {
      const paramSig = sig.parameters.find((element) => element.typeInfo.name === param);
      if (paramSig) {
        returnString += `    arg_${snakeCase(paramSig.typeInfo.name)}: ${this.convertToPythonType(
          paramSig.typeInfo
        )},\n`;
      }
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

  private buildAssistantParmDec(sig: Assistant, allParamsSorted: string[]): string {
    let returnString = '';
    for (const param of allParamsSorted) {
      const paramSig = sig.parameters.find((element) => element.typeInfo.name === param);
      if (paramSig) {
        returnString += `@parameter('arg_${snakeCase(paramSig.typeInfo.name)}', action_parameter_name='${
          paramSig.typeInfo.name
        }')\n`;
      }
    }
    return returnString;
  }

  private generatePythonStubs(): void {
    let funcSigs: FunctionSignature[] = [];
    const actionPythonPath = path.join(this.workspaceRoot, 'adapter');

    let files: string[] = [];
    function getFilesRecursive(directory: string) {
      fs.readdirSync(directory).forEach((file) => {
        const absolute = path.join(directory, file);
        if (fs.statSync(absolute).isDirectory()) {
          return getFilesRecursive(absolute);
        } else if (absolute.endsWith('.py')) {
          return files.push(absolute);
        }
      });
    }
    getFilesRecursive(actionPythonPath);
    let allFunctionSigs = [];
    for (const file of files) {
      if (pathExists(actionPythonPath)) {
        allFunctionSigs.push(new BuildPythonSignatures().build(file));
      }
    }

    let pythonContent = '# GENERATED FILE: DO NOT EDIT BY HAND\n';
    pythonContent += '# REGEN USING EXTENSION\n';
    pythonContent += 'from typing import List, Tuple\n';
    pythonContent += 'from dataclasses import dataclass\n';
    pythonContent += 'from artificial.workflows.decorators import action, return_parameter\n\n';

    for (const funcSig of allFunctionSigs) {
      for (const sig of funcSig.signatures) {
        let actionName = '';
        let functionName = '';
        if (funcSig.module !== '') {
          actionName = funcSig.module + '/' + sig.name;
          functionName = funcSig.module + '_' + sig.name;
        } else {
          actionName = sig.name;
          functionName = sig.name;
        }
        pythonContent = pythonContent.concat('\n');
        pythonContent = pythonContent.concat(
          "@action(capability='', name='",
          actionName,
          '\', display_name="',
          sig.name,
          '")'
        );
        pythonContent = pythonContent.concat('\n');
        let functionString = 'async def ' + functionName + '(';
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
    }

    fs.writeFile(path.join(this.workspaceRoot, 'workflow', 'stubs_actions.py'), pythonContent, (err) => {
      if (err) {
        return vscode.window.showErrorMessage('Failed to create boilerplate file!');
      }
    });
  }
}
