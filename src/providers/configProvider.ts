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

export class ConfigValues {
  private static instance: ConfigValues;
  private constructor(private hostName: string = '', private apiToken: string = '') {
    this.hostName = process.env.ARTIFICIAL_HOST ?? '';

    this.apiToken = process.env.ARTIFICIAL_TOKEN ?? '';

    if (!this.hostName) {
      vscode.window.showErrorMessage('Host Name not found in artificial.env');
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
