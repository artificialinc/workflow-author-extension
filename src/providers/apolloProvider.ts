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

import { ApolloClient, HttpLink, from, gql } from '@apollo/client/core';
import * as fs from 'fs';
import { RetryLink } from '@apollo/client/link/retry';
import { InMemoryCache } from '@apollo/client/cache/';
import fetch from 'cross-fetch';
import { parse } from 'yaml';
import * as path from 'path';
import * as vscode from 'vscode';
import ApolloLinkTimeout from 'apollo-link-timeout';
import { pathExists } from '../utils';
export interface LabReply {
  labs: [{ name: string; id: string }];
}
export interface ConfigReply {
  lab: {
    assets: [
      {
        id: string;
        loadingConfigId: string;
        loadingConfigOrder: number;
        labId: string;
        name: string;
      }
    ];
  };
}
export interface AssistantReply {
  assistants: Assistant[];
}

export interface Assistant {
  name: string;
  id: string;
  constraint: {
    labId: string;
  };
  parameters: [
    {
      input: string;
      typeInfo: AssistantTypeInfo;
    }
  ];
}
export interface AssistantTypeInfo {
  name: string;
  type: string;
  subTypes: [
    {
      type: string;
    }
  ];
}
export interface ActionReply {
  action: { id: string };
}
export interface OrgConfigReply {
  getCurrentOrgConfiguration: {
    configValuesDocument: string;
    schemaDocument: string;
  };
}

export interface LabConfigReply {
  getCurrentLabConfiguration: {
    configValuesDocument: string;
    schemaDocument: string;
  };
}

export class ArtificialApollo {
  private static instance: ArtificialApollo;
  private hostName;
  private apiToken;
  private retryLink;
  public apollo;
  constructor() {
    let rootPath =
      vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
        ? vscode.workspace.workspaceFolders[0].uri.fsPath
        : undefined;
    if (!rootPath) {
      vscode.window.showInformationMessage('No Root Path Found');
      rootPath = '';
    }

    const configPath = path.join(rootPath, 'config.yaml');
    if (!pathExists(configPath)) {
      vscode.window.showErrorMessage('No config.yaml found for host & token');
    }

    const config = parse(fs.readFileSync(configPath, 'utf-8'));
    this.hostName = 'https://' + config.artificial.host + '/graphql';
    this.apiToken = config.artificial.token;

    this.retryLink = new RetryLink({
      delay: {
        initial: 100,
        max: 2000,
        jitter: true,
      },
      attempts: {
        max: 1,
        retryIf: (error, _operation) => !!error, // eslint-disable-line
      },
    });
    this.apollo = this.createApollo();
  }
  public static getInstance(): ArtificialApollo {
    if (!ArtificialApollo.instance) {
      ArtificialApollo.instance = new ArtificialApollo();
    }
    return ArtificialApollo.instance;
  }
  private createApollo(): any {
    try {
      if (this.apollo) {
        console.log('Tried to create duplicate apollo client.');
        return this.apollo;
      }

      const httpLink = new HttpLink({
        uri: this.hostName,
        credentials: 'include',
        headers: {
          authorization: `Bearer ${this.apiToken}`,
          cookie: `artificial-org=${'artificial'}`,
        },
        fetch,
      });
      const timeoutLink = new ApolloLinkTimeout(3000);
      const timeoutHttpLink = timeoutLink.concat(httpLink);
      console.log('Hostname: ', this.hostName);
      this.apollo = new ApolloClient({
        link: from([this.retryLink, timeoutHttpLink]),
        cache: new InMemoryCache({}),
        defaultOptions: {
          query: {
            fetchPolicy: 'no-cache',
          },
          mutate: {
            fetchPolicy: 'no-cache',
          },
        },
      });

      return this.apollo;
    } catch (err) {
      console.error('Exception creating apollo client.');
      console.log(JSON.stringify(err, null, 2));
    }
  }

  public async queryWorkflows() {
    try {
      if (!this.apollo) {
        console.error('ApolloClient missing.');
        return;
      }
      const result = await this.apollo.query({
        query: gql`
          query workflows {
            workflows {
              id
            }
          }
        `,
      });

      if (result && result.data) {
        return result.data;
      }
    } catch (err) {
      console.log(JSON.stringify(err, null, 2));
    }
  }

  public async queryAssistants(): Promise<AssistantReply | undefined> {
    try {
      if (!this.apollo) {
        console.error('ApolloClient missing.');
        return;
      }
      const result = await this.apollo.query({
        query: gql`
          query assistants {
            assistants {
              name
              id
              constraint {
                labId
              }
              parameters {
                input
                typeInfo {
                  name
                  type
                  subTypes {
                    type
                  }
                }
              }
            }
          }
        `,
      });
      if (result && result.data) {
        return result.data;
      }
    } catch (err) {
      console.log(JSON.stringify(err, null, 2));
    }
  }
  public async queryLabs(): Promise<LabReply | undefined> {
    try {
      if (!this.apollo) {
        console.error('ApolloClient missing.');
        return;
      }
      const result = await this.apollo.query({
        query: gql`
          query labs {
            labs {
              id
              name
            }
          }
        `,
      });

      if (result && result.data) {
        return result.data;
      }
    } catch (err) {
      console.log(JSON.stringify(err, null, 2));
    }
  }
  public async queryConfigs(labId: string): Promise<ConfigReply | undefined> {
    try {
      if (!this.apollo) {
        console.error('ApolloClient missing.');
        return;
      }
      const result = await this.apollo.query({
        variables: {
          labId,
        },
        query: gql`
          query configs($labId: ID!) {
            lab(id: $labId) {
              assets {
                id
                name
                loadingConfigId
                loadingConfigOrder
                labId
              }
            }
          }
        `,
      });

      if (result && result.data) {
        return result.data;
      }
    } catch (err) {
      console.log(JSON.stringify(err, null, 2));
    }
  }

  public async queryAction(actionId: string): Promise<ActionReply | undefined> {
    try {
      if (!this.apollo) {
        console.error('ApolloClient missing.');
        return;
      }
      const result = await this.apollo.query({
        variables: {
          actionId,
        },
        query: gql`
          query action($actionId: ID!) {
            action(id: $actionId) {
              id
            }
          }
        `,
      });

      if (result && result.data) {
        return result.data;
      }
    } catch (err) {
      console.log(JSON.stringify(err, null, 2));
    }
  }

  public async deleteAction(actionId: string): Promise<ActionReply | undefined> {
    try {
      if (!this.apollo) {
        console.error('ApolloClient missing.');
        return;
      }
      const result = await this.apollo.mutate({
        variables: {
          actionId,
        },
        mutation: gql`
          mutation deleteAction($actionId: ID!) {
            deleteAction(id: $actionId)
          }
        `,
      });

      if (result && result.data) {
        return result.data;
      }
    } catch (err) {
      console.log(JSON.stringify(err, null, 2));
    }
  }
  public async queryOrgConfig(): Promise<OrgConfigReply | undefined> {
    try {
      if (!this.apollo) {
        console.error('ApolloClient missing.');
        return;
      }
      const result = await this.apollo.query({
        query: gql`
          query orgConfig {
            getCurrentOrgConfiguration {
              configValuesDocument
              schemaDocument
            }
          }
        `,
      });

      if (result && result.data) {
        return result.data;
      }
    } catch (err) {
      console.log(JSON.stringify(err, null, 2));
    }
  }

  public async queryLabConfigs(labId: string): Promise<LabConfigReply | undefined> {
    try {
      if (!this.apollo) {
        console.error('ApolloClient missing.');
        return;
      }
      const result = await this.apollo.query({
        variables: {
          labId,
        },
        query: gql`
          query labConfigs($labId: ID!) {
            getCurrentLabConfiguration(labId: $labId) {
              configValuesDocument
              schemaDocument
            }
          }
        `,
      });

      if (result && result.data) {
        return result.data;
      }
    } catch (err) {
      console.log(JSON.stringify(err, null, 2));
    }
  }
}
