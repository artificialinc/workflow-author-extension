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
import * as parse from 'yaml';
import * as path from 'path';
import { pathExists } from '../utils';
import * as fs from 'fs';
export class ConfigValues {
  private static instance: ConfigValues;
  private constructor(private hostName: string = '', private apiToken: string = '') {
    this.initialize();
  }
  private initialize() {
    let rootPath =
      vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
        ? vscode.workspace.workspaceFolders[0].uri.fsPath
        : undefined;
    if (!rootPath) {
      vscode.window.showInformationMessage('No Root Path Found');
      rootPath = '';
    }
    const configPath = path.join(rootPath, 'tmp/merged.yaml');

    if (!pathExists(configPath)) {
      vscode.window.showErrorMessage('No config found for host & token');
    }

    const config: any = parse.parse(fs.readFileSync(configPath, 'utf-8'));
    if (!config) {
      this.hostName = '';
      this.apiToken = '';
      return;
    }
    this.hostName = config.artificial.host ?? '';

    this.apiToken = config.artificial.token ?? '';
  }
  public static getInstance(): ConfigValues {
    if (!ConfigValues.instance) {
      ConfigValues.instance = new ConfigValues();
    }
    return ConfigValues.instance;
  }
  public getHost() {
    return this.hostName;
  }
  public getToken() {
    return this.apiToken;
  }
  public reset() {
    this.initialize();
  }
}
