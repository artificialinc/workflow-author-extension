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
import { pathExists } from '../utils';
import * as path from 'path';
import * as fs from 'fs';
import * as parse from 'yaml';

export class ConfigValues {
  private static instance: ConfigValues;
  private constructor(private hostName: string = '', private apiToken: string = '') {
    let rootPath =
      vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
        ? vscode.workspace.workspaceFolders[0].uri.fsPath
        : undefined;
    if (!rootPath) {
      vscode.window.showInformationMessage('No Root Path Found');
      rootPath = '';
    }
    const customConfigPath = vscode.workspace.getConfiguration('artificialWorkflows').configPath;
    const configPath = path.join(rootPath, customConfigPath);

    if (!pathExists(configPath)) {
      vscode.window.showErrorMessage('No config.yaml found for host & token');
    }

    const config: any = parse.parse(fs.readFileSync(configPath, 'utf-8'));

    this.hostName = process.env.ARTIFICIAL_HOST ? process.env.ARTIFICIAL_HOST : config.artificial.host;

    this.apiToken = process.env.ARTIFICIAL_TOKEN ? process.env.ARTIFICIAL_TOKEN : config.artificial.token;

    if (!this.hostName) {
      vscode.window.showErrorMessage('Host Name not found in config.yaml');
    }
    if (!this.apiToken) {
      vscode.window.showErrorMessage('API Token not found in artificial.env');
    }
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
}
