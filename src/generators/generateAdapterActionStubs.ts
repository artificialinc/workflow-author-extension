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

// High Prio
// TODO: Return Parameter decorator
// TODO: Capability Support

// Medium Prio
// TODO: TreeView by module

// Low priority
// TODO: python-AST throws on walrus operator
// TODO: does not handle nested types eg. t.List[t.List[foo]]

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { FileData } from '../apis/types';
import { pathExists } from '../utils';
import { OutputLog } from '../providers/outputLogProvider';
import { BuildPythonSignatures } from '../parsers/parsePythonSignatures';
import * as _ from 'lodash';
import { PythonTreeView } from '../views/adapterActionTreeView';

export class GenerateAdapterActionStubs {
  outputChannel = OutputLog.getInstance();
  constructor(private workspaceRoot: string, private adapterActionTree: PythonTreeView) {}

  async generateAdapterActionStubsCommand(): Promise<any> {
    await this.generatePythonStubs();
  }

  private async generatePythonStubs(): Promise<void> {
    vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: 'Stub Generation', cancellable: false },
      async (progress) => {
        progress.report({ increment: 0 });
        const actionPythonPath = path.join(this.workspaceRoot, 'adapter');
        const files = await this.getFileList(actionPythonPath);
        const allPythonData: (FileData | null)[] = [];
        for (const file of files) {
          if (pathExists(actionPythonPath)) {
            const increment = (1 / files.length) * 100;
            progress.report({ increment: increment });
            allPythonData.push(await new BuildPythonSignatures().build(file));
            // Yield to let the UI update the notification banner
            await new Promise<void>((r) => setTimeout(r, 50));
          }
        }
        const compactedData = _.compact(allPythonData);
        await this.printStubs(compactedData);
      }
    );
  }

  private async getFileList(actionPythonPath: string) {
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
    return files;
  }

  private async printStubs(allFiles: FileData[]) {
    let pythonContent = '';

    pythonContent += this.printHeader();

    for (const singleFileData of allFiles) {
      pythonContent += this.printDataClasses(singleFileData, allFiles);
      pythonContent += this.printActionSignatures(singleFileData);
    }

    const customPythonStubPath = vscode.workspace.getConfiguration('artificial.workflow.author').adapterActionStubPath;
    const fullPath = path.join(this.workspaceRoot, customPythonStubPath);
    fs.writeFile(path.join(fullPath), pythonContent, (err) => {
      vscode.window.showInformationMessage('Created Adapter Action Stub File');
      this.adapterActionTree.refresh();
      if (err) {
        return vscode.window.showErrorMessage('Failed to create boilerplate file!');
      }
    });
  }

  private printHeader() {
    let outputString = '';
    outputString += '# GENERATED FILE: DO NOT EDIT BY HAND\n';
    outputString += '# REGEN USING EXTENSION\n';
    outputString += 'from typing import Dict, List, Tuple\n';
    outputString += 'from dataclasses import dataclass\n';
    outputString += 'from artificial.workflows.decorators import action, return_parameter\n\n';
    return outputString;
  }

  private printDataClasses(singleFileData: FileData, allFiles: FileData[]) {
    let outputString = '';
    for (const dataclass of singleFileData.sigsAndTypes.dataclasses) {
      let matches = [];
      for (const findClass of allFiles) {
        for (const func of findClass.sigsAndTypes.functions) {
          matches.push(func.parameters.filter((s) => s.type.includes(dataclass.name)));
        }
        // TODO: This needs to also ensure the dataclass referencing it is included in an action stub
        for (const dataClass of findClass.sigsAndTypes.dataclasses) {
          matches.push(dataClass.members.filter((s) => s.type.includes(dataclass.name)));
        }
      }

      if (_.flatten(matches).length > 0) {
        outputString += '\n';
        outputString += '@dataclass\n';
        outputString += 'class ' + dataclass.name + ':';
        outputString += '\n';
        for (const member of dataclass.members) {
          outputString += '\t' + member.name + member.type + '\n';
        }
      }
    }
    return outputString;
  }

  private printActionSignatures(singleFileData: FileData) {
    let outputString = '';
    for (const sig of singleFileData.sigsAndTypes.functions) {
      let actionName = '';
      let functionName = '';
      if (singleFileData.module !== '') {
        actionName = singleFileData.module + '/' + sig.name;
        functionName = singleFileData.module + '_' + sig.name;
      } else {
        actionName = sig.name;
        functionName = sig.name;
      }
      outputString += '\n';
      outputString += "@action(capability='', name='" + actionName + '\', display_name="' + sig.name + '")';
      outputString += '\n';
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
      outputString += functionString;
      outputString += '\n';
      outputString += '    pass\n\n';
    }
    return outputString;
  }
}
