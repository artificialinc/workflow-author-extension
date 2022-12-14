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
export class OutputLog {
  private static instance: OutputLog;
  private channel: vscode.OutputChannel;
  private constructor() {
    this.channel = vscode.window.createOutputChannel('Artificial-Workflows');
  }
  public static getInstance(): OutputLog {
    if (!OutputLog.instance) {
      OutputLog.instance = new OutputLog();
    }
    return OutputLog.instance;
  }
  public log(value: string) {
    this.channel.appendLine(value);
  }
}
