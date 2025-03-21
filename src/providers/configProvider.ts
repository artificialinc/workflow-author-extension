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
import { PythonExtension } from '@vscode/python-extension';
import * as vscode from 'vscode';
import * as parse from 'yaml';
import * as path from 'path';
import { pathExists } from '../utils';
import * as fs from 'fs';
import { GitExtension } from '../git/git';
import { parse as envParse } from 'dotenv';
import { OutputLog } from './outputLogProvider';
import { ArtificialApollo } from './apolloProvider';
let _python: PythonExtension;

export class ConfigValues {
  private static instance: ConfigValues;
  private outputLog;

  private constructor(
    private hostName: string = '',
    private apiToken: string = '',
    private adapterActionStubPath = '',
    private adapterActionStubFolder = '',
    private enableFolderBasedStubGeneration = false,
    private assistantStubPath = '',
    private prefix: string = '',
    private orgId: string = '',
    private labId: string = '',
    private gitRemote: string = '',
    private githubUser: string = '',
    private githubToken: string = '',
  ) {
    this.outputLog = OutputLog.getInstance();
    this.initialize();
  }
  private async initialize() {
    let rootPath =
      vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
        ? vscode.workspace.workspaceFolders[0].uri.fsPath
        : undefined;
    if (!rootPath) {
      vscode.window.showInformationMessage('No Root Path Found');
      rootPath = '';
    }
    this.loadEnvFile(rootPath);
    // Set git remote
    this.gitRemote = this.getGitRemote() ?? '';
    const configPath = path.join(rootPath, 'tmp/merged.yaml');

    if (!pathExists(configPath)) {
      this.hostName = '';
      this.apiToken = '';
      this.prefix = '';
      this.orgId = '';
      this.labId = '';
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config: any = parse.parse(fs.readFileSync(configPath, 'utf-8'));
    if (!config || config.error) {
      this.hostName = '';
      this.apiToken = '';
      this.prefix = '';
      this.orgId = '';
      this.labId = '';
      return;
    }

    const customAdapterActionStubPath =
      vscode.workspace.getConfiguration('artificial.workflow.author').adapterActionStubPath;

    this.adapterActionStubPath = path.join(rootPath, customAdapterActionStubPath);

    // Set up config values for breaking stub generation changes to allow for scoped stubs by using multiple directories and files
    this.enableFolderBasedStubGeneration =
      vscode.workspace.getConfiguration('artificial.workflow.author').enableFolderBasedStubGeneration;
    const customAdapterActionStubFolder =
      vscode.workspace.getConfiguration('artificial.workflow.author').adapterActionStubFolder;
    this.adapterActionStubFolder = path.join(rootPath, customAdapterActionStubFolder);

    const customAssistantStubPath = vscode.workspace.getConfiguration('artificial.workflow.author').assistantStubPath;
    this.assistantStubPath = path.join(rootPath, customAssistantStubPath);

    this.hostName = config.artificial.host ?? '';
    this.apiToken = config.artificial.token ?? '';
    this.prefix = config.artificial.prefix ?? '';
    this.labId = config.artificial.labId ?? '';
    this.orgId = config.artificial.orgId ?? '';
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
  public getAdapterActionStubPath() {
    return this.adapterActionStubPath;
  }
  public getAdapterActionStubFolder() {
    return this.adapterActionStubFolder;
  }
  public folderBasedStubGenerationEnabled() {
    return this.enableFolderBasedStubGeneration;
  }
  public getAssistantStubPath() {
    return this.assistantStubPath;
  }
  public getPrefix() {
    return this.prefix;
  }
  public getOrgId() {
    return this.orgId;
  }
  public getLabId() {
    return this.labId;
  }
  public async reset() {
    await this.initialize();
  }
  public getGitRemoteUrl() {
    return this.gitRemote;
  }
  public getGithubUser() {
    return this.githubUser;
  }
  public getGithubToken() {
    return this.githubToken;
  }
  public async getLabName(): Promise<string> {
    const client = ArtificialApollo.getInstance();
    const labs = await client.queryLabs();
    const labData = labs?.labs.find((lab) => lab.id === this.labId);
    if (labData) {
      return labData.name;
    } else {
      return '';
    }
  }

  private getGitRemote(): string | undefined {
    const gitExtension = vscode.extensions.getExtension<GitExtension>('vscode.git');
    if (!gitExtension) {
      vscode.window.showErrorMessage('Git extension required for Artificial Workflow');
      return;
    }
    const git = gitExtension.exports;
    const api = git.getAPI(1);

    this.outputLog.log('Looking for git repository');

    if (api.repositories.length !== 1) {
      vscode.window.showErrorMessage('Artificial Workflow requires a single git repository');
      return;
    }

    const repository = api.repositories[0];

    this.outputLog.log(`Found git repository. Looking for remotes`);

    // Loop for 10 tries waiting for remotes to load. Can't sleep because not in async function
    let count = 0;
    while (!repository.state.remotes && count < 10) {
      count++;
      this.outputLog.log(`Waiting for remotes to load. Attempt ${count}`);
    }

    if (!repository.state.remotes) {
      vscode.window.showErrorMessage(
        'Artificial Workflow requires a git repository with remotes. Error loading repository data',
      );
    }

    // Make sure remote origin is set
    const origin = repository.state.remotes.find((remote) => remote.name === 'origin');
    if (!origin) {
      this.outputLog.log(
        `No remote named origin found. Remotes: ${repository.state.remotes.map((remote) => remote.name).join(', ')}`,
      );
      vscode.window.showErrorMessage('Artificial Workflow requires a remote origin');
      return;
    }

    if (!origin.fetchUrl) {
      vscode.window.showErrorMessage('Artificial Workflow requires a remote origin fetch url');
      return;
    }

    return origin.fetchUrl;
  }

  private loadEnvFile(rootPath: string) {
    const envPath = path.join(rootPath, '.env');
    if (!pathExists(envPath)) {
      return;
    }

    const env = envParse(fs.readFileSync(envPath, 'utf-8'));
    if (!env.PYPI_USER) {
      vscode.window.showErrorMessage('PYPI_USER not found in .env file');
      return;
    }
    this.githubUser = env.PYPI_USER;
    if (!env.PYPI_PASSWORD) {
      vscode.window.showErrorMessage('PYPI_PASSWORD not found in .env file');
      return;
    }
    this.githubToken = env.PYPI_PASSWORD;
  }

  public static async getPythonInterpreter(): Promise<string> {
    const pythonExtension = vscode.extensions.getExtension('ms-python.python');
    if (!pythonExtension) {
      vscode.window.showErrorMessage('Python extension is not installed');
      return '';
    }
    if (!pythonExtension.isActive) {
      await pythonExtension.activate();
    }

    const api = pythonExtension.exports;
    const interpreterPath = api.settings.getExecutionDetails().execCommand;
    OutputLog.getInstance().log(
      `Python interpreter: ${interpreterPath ? path.dirname(interpreterPath.join(' ')) : 'Not found'}`,
    );

    if (!interpreterPath) {
      vscode.window.showErrorMessage('Python interpreter not found');
    }
    return interpreterPath ? path.dirname(interpreterPath.join(' ')) : '';
  }
}
