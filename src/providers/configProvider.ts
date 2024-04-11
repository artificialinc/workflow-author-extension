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
import YAML from 'yaml';
import * as path from 'path';
import { pathExists, pathIsDirectory } from '../utils';
import * as fs from 'fs';
import { GitExtension } from '../git/git';
import { parse as envParse } from 'dotenv';
import { OutputLog } from './outputLogProvider';
import { defaultsDeep } from 'lodash';

type ArtificialConfig = { [key: string]: string };

export class ConfigValues {
  private static instance: ConfigValues;
  private outputLog;
  private openTokenPrompt: Thenable<string | undefined> | null = null;
  private openDeployTargetPrompt: Thenable<string | undefined> | null = null;

  private constructor(
    private hostName: string = '',
    private apiToken: string = '',
    private adapterActionStubPath = '',
    private assistantStubPath = '',
    private prefix: string = '',
    private orgId: string = '',
    private labId: string = '',
    private gitRemote: string = '',
    private githubUser: string = '',
    private githubToken: string = '',
    private artificialConfigRoot: string = '',
    private contextFilePath: string = ''
  ) {
    this.outputLog = OutputLog.getInstance();
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

    let config = null;
    try {
      config = YAML.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch (err) {
      vscode.window.showErrorMessage(`Error parsing active config`);
    }

    if (!config) {
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
  public reset() {
    this.initialize();
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

  public promptForToken = async () => {
    if (this.openDeployTargetPrompt) {
      return;
    }

    if (this.openTokenPrompt) {
      return this.openTokenPrompt;
    }

    if (!this.isActiveContextValid()) {
      vscode.window.showErrorMessage(
        'Invalid active context. Please set contexts/context.yaml to point to a valid config folder.'
      );
      return;
    }

    const activeSecretsFilePath = this.getActiveSecretsFilePath();
    const rawSecrets = safeReadFileSync(activeSecretsFilePath);

    // Test whether setting the token will work before we prompt
    try {
      mergeArtificialConfig(rawSecrets);
    } catch (err) {
      vscode.window.showErrorMessage(`Error parsing ${activeSecretsFilePath}`);
      return;
    }

    this.openTokenPrompt = vscode.window.showInputBox({
      password: true,
      title: 'Artificial API Token',
      prompt: `Please enter your Artificial API token`,
      placeHolder: 'art_YTQ2OWE3ZGMtZDIzNy00ZDMxLThmMjYtNDkzYTQyNjJmNmNk',
    });

    const token = await this.openTokenPrompt;
    this.openTokenPrompt = null;

    if (!token) {
      this.outputLog.log(`No token given. Enter one when you're ready`);
      return;
    }

    const newSecrets = mergeArtificialConfig(rawSecrets, { token });
    fs.writeFileSync(activeSecretsFilePath, newSecrets);
  };

  public promptForNewDeployTarget = async () => {
    if (this.openDeployTargetPrompt) {
      return this.openDeployTargetPrompt;
    }

    this.openDeployTargetPrompt = vscode.window.showInputBox({
      title: 'Set deployment target',
      prompt: `Enter the URL of the instance to deploy to`,
      placeHolder: 'https://sales.artificial.com/app/#/ops/lab_3581adc9-2998-4903-beec-12d64a2f74c9',
    });

    const deployUrl = await this.openDeployTargetPrompt;
    this.openDeployTargetPrompt = null;

    if (!deployUrl) {
      this.outputLog.log(`No deploy target given. Enter one when you're ready`);
      return;
    }

    this.outputLog.log(`Setting new deploy target: ${deployUrl}`);

    const { host, lab } = parseDeployConfigFromUrl(deployUrl);

    if (!host || !lab) {
      vscode.window.showErrorMessage(
        'Invalid deploy target URL. Should be of the form https://sales.artificial.com/app/#/ops/lab_3581adc9-2998-4903-beec-12d64a2f74c9'
      );
      return;
    }

    const configFolderPath = path.join(this.artificialConfigRoot, host);
    if (!fs.existsSync(configFolderPath)) {
      fs.mkdirSync(configFolderPath, { recursive: true });
    }

    const configFilePath = this.getConfigFilePath(host);
    const currentConfig = safeReadFileSync(configFilePath);
    const newConfig = mergeArtificialConfig(currentConfig, { host, lab });
    fs.writeFileSync(configFilePath, newConfig, 'utf-8');

    this.setActiveContext(host);
  };

  private getActiveContext(): string {
    try {
      const rawContextFile = fs.readFileSync(this.contextFilePath, 'utf-8');
      return YAML.parse(rawContextFile).activeContext;
    } catch (error) {
      const allContexts = this.listConfigContexts();
      if (allContexts.length === 1) {
        return allContexts[0];
      }
      throw error;
    }
  }

  private setActiveContext(context: string) {
    try {
      let currentContext = {};
      if (fs.existsSync(this.contextFilePath)) {
        const rawContextFile = fs.readFileSync(this.contextFilePath, 'utf-8');
        currentContext = YAML.parse(rawContextFile);
      }
      const newContext = defaultsDeep({ activeContext: context }, currentContext);
      fs.writeFileSync(this.contextFilePath, YAML.stringify(newContext));
    } catch (error) {
      vscode.window.showErrorMessage(`Error setting active context.`);
    }
  }

  private isActiveContextValid(): boolean {
    try {
      const activeContextPath = path.join(this.artificialConfigRoot, this.getActiveContext());
      return pathIsDirectory(activeContextPath);
    } catch (err: any) {
      this.outputLog.log(err.toString());
      return false;
    }
  }

  private listConfigContexts(): string[] {
    try {
      const entries = fs.readdirSync(this.artificialConfigRoot, { withFileTypes: true });
      const folders = entries.filter((dirent) => dirent.isDirectory()).map((dirent) => dirent.name);
      return folders;
    } catch (error) {
      console.error(`Error reading contexts from ${this.artificialConfigRoot}`, error);
      return [];
    }
  }

  private getActiveSecretsFilePath() {
    return path.join(this.artificialConfigRoot, this.getActiveContext(), 'secrets.yaml');
  }

  private getConfigFilePath(config: string): string {
    return path.join(this.artificialConfigRoot, config, 'config.yaml');
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
        'Artificial Workflow requires a git repository with remotes. Error loading repository data'
      );
    }

    // Make sure remote origin is set
    const origin = repository.state.remotes.find((remote) => remote.name === 'origin');
    if (!origin) {
      this.outputLog.log(
        `No remote named origin found. Remotes: ${repository.state.remotes.map((remote) => remote.name).join(', ')}`
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

    const env = defaultsDeep(envParse(fs.readFileSync(envPath, 'utf-8')), process.env);
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

    if (!env.ARTIFICIAL_CONFIG_ROOT) {
      vscode.window.showErrorMessage('ARTIFICIAL_CONFIG_ROOT not set');
      return;
    }
    this.artificialConfigRoot = env.ARTIFICIAL_CONFIG_ROOT;
    this.contextFilePath = path.join(this.artificialConfigRoot, 'context.yaml');
  }
}

export const mergeArtificialConfig = (rawBaseConfig: string, newConfig: ArtificialConfig = {}): string => {
  const baseConfig = YAML.parseDocument(rawBaseConfig);

  if (!baseConfig.contents) {
    return YAML.stringify({ artificial: newConfig });
  }

  if (!YAML.isMap(baseConfig.contents)) {
    throw new Error('File must be a YAML map.');
  }

  if (!baseConfig.has('artificial')) {
    baseConfig.set('artificial', baseConfig.createNode(newConfig));
    return baseConfig.toString();
  }

  let artificialNode = baseConfig.get('artificial', true) as YAML.Node;

  if (YAML.isScalar(artificialNode)) {
    if (artificialNode.value === null) {
      const oldNode = artificialNode;
      const newArtificialNode = baseConfig.createNode(newConfig);
      newArtificialNode.commentBefore = oldNode.commentBefore ?? '' + oldNode.comment ?? '';
      newArtificialNode.spaceBefore = oldNode.spaceBefore;
      baseConfig.set('artificial', newArtificialNode);
      const firstKey = Object.keys(newConfig)[0];
      return baseConfig.toString();
    }
  }

  if (!YAML.isMap(artificialNode)) {
    throw new Error('Secrets file must have an artificial key that is a map.');
  }

  for (const [key, value] of Object.entries(newConfig)) {
    artificialNode.set(key, value);
  }
  return baseConfig.toString();
};

export const parseDeployConfigFromUrl = (rawUrl: string) => {
  try {
    const targetUrl = new URL(rawUrl);
    const hostname = targetUrl.hostname;
    const labId = targetUrl.hash.split('?')[0].match(/\/ops\/([^\/]+)\/?/)?.[1];
    return { host: hostname, lab: labId };
  } catch (err) {
    return {};
  }
};

const safeReadFileSync = (path: string): string => {
  if (pathExists(path)) {
    return fs.readFileSync(path, 'utf-8');
  }

  return '';
};
