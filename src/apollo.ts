import { ApolloClient, HttpLink, from, gql } from '@apollo/client/core';
import * as fs from 'fs';
import { RetryLink } from '@apollo/client/link/retry';
import { InMemoryCache } from '@apollo/client/cache/';
import fetch from 'cross-fetch';
import { parse } from 'yaml';
import * as path from 'path';
import * as vscode from 'vscode';
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

      this.apollo = new ApolloClient({
        link: from([this.retryLink, httpLink]),
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
}
