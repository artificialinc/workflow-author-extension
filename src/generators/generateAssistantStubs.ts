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
import * as path from 'path';
import { OutputLog } from '../providers/outputLogProvider';
import { AssistantByLabTreeView } from '../views/assistantTreeView';

import * as _ from 'lodash';
import { artificialAwaitTask } from '../utils';

export class GenerateAssistantStubs {
  outputChannel = OutputLog.getInstance();
  constructor(
    context: vscode.ExtensionContext,
    private workspaceRoot: string,
    private assistantByLab: AssistantByLabTreeView
  ) {
    // context.subscriptions.push(
    //   vscode.commands.registerCommand('assistantsByLab.generateAssistantStubs', () =>
    //     this.generateAssistantStubsCommand()
    //   )
    // );
  }

  async generateAssistantStubsCommand(): Promise<any> {
    await this.generateAssistantStubs();
    await this.assistantByLab.refresh();
  }

  private async generateAssistantStubs(): Promise<void> {
    const customAssistantStubPath = vscode.workspace.getConfiguration('artificial.workflow.author').assistantStubPath;
    const fullPath = path.join(this.workspaceRoot, customAssistantStubPath);
    await artificialAwaitTask('Generate Assistant Stubs', `wf assistantstubs -o ${fullPath}`);
  }
}
