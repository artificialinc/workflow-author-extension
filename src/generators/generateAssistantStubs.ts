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
import { ArtificialApollo, Assistant, AssistantTypeInfo } from '../providers/apolloProvider';
import { OutputLog } from '../providers/outputLogProvider';
import { snakeCase, camelCase } from 'lodash';
import { AssistantByLabTreeView } from '../views/assistantTreeView';

import * as _ from 'lodash';
import { artificialTask } from '../utils';

export class GenerateAssistantStubs {
  outputChannel = OutputLog.getInstance();
  constructor(
    context: vscode.ExtensionContext,
    private workspaceRoot: string,
    private assistantByLab: AssistantByLabTreeView
  ) {
    context.subscriptions.push(
      vscode.commands.registerCommand('assistantsByLab.generateAssistantStubs', () =>
        this.generateAssistantStubsCommand()
      )
    );
  }

  async generateAssistantStubsCommand(): Promise<any> {
    await this.generateAssistantStubsTerminal();
    await this.assistantByLab.refresh();
  }

  private async generateAssistantStubsTerminal(): Promise<void> {
    const customAssistantStubPath = vscode.workspace.getConfiguration('artificial.workflow.author').assistantStubPath;
    const fullPath = path.join(this.workspaceRoot, customAssistantStubPath);
    artificialTask('Generate Assistant Stubs', `wf assistantstubs -o ${fullPath}`);
    return;
  }

  private async generateAssistantStubs(): Promise<void> {
    const client = ArtificialApollo.getInstance();
    const response = await client.queryAssistants();
    const customAssistantStubPath = vscode.workspace.getConfiguration('artificial.workflow.author').assistantStubPath;
    const fullPath = path.join(this.workspaceRoot, customAssistantStubPath);

    let pythonContent = '# GENERATED FILE: DO NOT EDIT BY HAND\n';
    pythonContent += '# REGEN USING EXTENSION\n';
    pythonContent += '# flake8: noqa\n';
    pythonContent += '# mypy: disable-error-code = empty-body\n';
    pythonContent += 'from typing import List, Tuple\n';
    pythonContent += 'from artificial.workflows.decorators import assistant, parameter, return_parameter\n\n\n';
    if (!response?.assistants) {
      return;
    }
    const labs = await client.queryLabs();
    if (!labs) {
      return;
    }
    for (const lab of labs.labs) {
      pythonContent += `class ${lab.name.charAt(0).toUpperCase() + camelCase(lab.name).slice(1)}Assistants:\n`;
      let labContainsAssistants = false;
      for (const sig of response.assistants) {
        if (lab.id === sig.constraint.labId) {
          labContainsAssistants = true;
          pythonContent += `\t@staticmethod\n`;
          pythonContent += `\t@assistant('${sig.id}')\n`;
          pythonContent += this.buildAssistantParmDec(sig);
          pythonContent += this.buildAssistantReturnDec(sig);
          pythonContent += `\tasync def assistant_${snakeCase(sig.name)}(\n`;
          pythonContent += this.buildAssistantParams(sig);
          pythonContent += `\t) -> `;
          pythonContent += this.buildAssistantReturn(sig);
          pythonContent += `:\n`;
          pythonContent += `\t\tpass\n\n\n`;
        }
      }
      if (!labContainsAssistants) {
        pythonContent += '\tpass\n\n\n';
      }
    }

    fs.writeFile(fullPath, pythonContent, (err) => {
      if (err) {
        return vscode.window.showErrorMessage('Failed to create boilerplate file!');
      }
    });
  }

  private buildAssistantParams(sig: Assistant): string {
    let returnString = '';

    for (const param of sig.parameters) {
      if (param.input) {
        returnString += `\t\targ_${snakeCase(param.typeInfo.name)}: ${this.convertToPythonType(param.typeInfo)},\n`;
      }
    }
    return returnString;
  }

  private buildAssistantReturn(sig: Assistant): string {
    let returnString = '';
    let paramString = '';
    for (const param of sig.parameters) {
      if (!param.input) {
        paramString += `${this.convertToPythonType(param.typeInfo)}, `;
      }
    }
    if (!paramString) {
      return 'None';
    } else {
      paramString = this.removeLastComma(paramString);
      returnString += `Tuple[${paramString}]`;
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
    for (const param of sig.parameters) {
      if (param.input) {
        returnString += `\t@parameter('arg_${snakeCase(param.typeInfo.name)}', parameter_id='${param.id}')\n`;
      }
    }
    return returnString;
  }
  private removeLastComma(str: string) {
    return str.replace(/,(\s+)?$/, '');
  }
  private buildAssistantReturnDec(sig: Assistant): string {
    let returnString = '';
    let returnParams = '';
    let returnIds = '';
    for (const param of sig.parameters) {
      if (!param.input) {
        returnParams += `'arg_${snakeCase(param.typeInfo.name)}', `;
        returnIds += `'${param.id}', `;
      }
    }
    if (returnParams) {
      returnParams = this.removeLastComma(returnParams);
      returnIds = this.removeLastComma(returnIds);
      returnString += `\t@return_parameter(parameter_id=[${returnIds}])\n`;
    }
    return returnString;
  }
}
