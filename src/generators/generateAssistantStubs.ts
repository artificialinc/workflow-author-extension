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
<<<<<<< HEAD:src/generators/generateAssistantStubs.ts
import { ArtificialApollo, Assistant, AssistantTypeInfo } from '../providers/apolloProvider';
import { OutputLog } from '../providers/outputLogProvider';
import { snakeCase } from 'lodash';
import { AssistantByLabTreeView } from '../views/assistantTreeView';
import { AssistantSignature, BuildAssistantSignatures } from '../parsers/parseAssistantSignatures';
import * as _ from 'lodash';
=======
import { pathExists } from '../utils';
import { ArtificialApollo, Assistant, AssistantTypeInfo } from '../providers/apolloProvider';
import { OutputLog } from '../providers/outputLogProvider';
import { snakeCase, camelCase } from 'lodash';
import { BuildPythonSignatures } from '../parsers/parsePythonSignatures';
import { AssistantByLabTreeView } from '../views/assistantTreeView';
import { BuildAssistantSignatures } from '../parsers/parseAssistantSignatures';
import _ = require('lodash');
>>>>>>> main:src/generators/generateActionStubs.ts

export class GenerateAssistantStubs {
  outputChannel = OutputLog.getInstance();
  constructor(private workspaceRoot: string, private assistantByLab: AssistantByLabTreeView) {}

  async generateAssistantStubsCommand(): Promise<any> {
    await this.generateAssistantStubs();
    await this.assistantByLab.refresh();
    vscode.window.showInformationMessage('Created Assistant Stub File');
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
          let allParamsSorted = this.getAllParamsSorted(sig, stubs);
          pythonContent += `\t@staticmethod\n`;
          pythonContent += `\t@assistant('${sig.id}')\n`;
          pythonContent += this.buildAssistantParmDec(sig, allParamsSorted);
          pythonContent += `\tasync def assistant_${snakeCase(sig.name)}(\n`;
          pythonContent += this.buildAssistantParams(sig, allParamsSorted);
          pythonContent += `\t) -> None:\n`;
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

  //TODO: Once we have fully updated all NS to use asst params with indices, this can be removed
  private getAllParamsSorted(apolloSignature: Assistant, stubs: AssistantSignature[]): string[] {
    let allParamsSorted: string[] = [];
    let stubParams = [];
    let alabParams = [];

    // Check if asst params have indices set
    let usingIndices = false;
    for (let param of apolloSignature.parameters) {
      alabParams.push(param.typeInfo.name);
      if (param.index > 0) {
        usingIndices = true;
      }
    }
    if (usingIndices) {
      return alabParams;
    }
    // If no explicit order set, fallback to using stubs as the order if they exist
    if (stubs) {
      const stubSignature = stubs.find((element) => element.actionId === apolloSignature.id);
      if (stubSignature) {
        for (let param of stubSignature?.parameters) {
          stubParams.push(param.assistantName);
        }
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
        returnString += `\t\targ_${snakeCase(paramSig.typeInfo.name)}: ${this.convertToPythonType(
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
        returnString += `\t@parameter('arg_${snakeCase(paramSig.typeInfo.name)}', action_parameter_name='${
          paramSig.typeInfo.name
        }')\n`;
      }
    }
    return returnString;
  }
}
