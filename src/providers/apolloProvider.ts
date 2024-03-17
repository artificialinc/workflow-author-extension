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
import { RetryLink } from '@apollo/client/link/retry';
import { InMemoryCache, NormalizedCacheObject } from '@apollo/client/cache/';
import fetch from 'cross-fetch';
import ApolloLinkTimeout from 'apollo-link-timeout';
import { ConfigValues } from './configProvider';
import { OutputLog } from './outputLogProvider';
import * as vscode from 'vscode';
import { debounce } from 'lodash';
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
      id: string;
      input: boolean;
      index: number;
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
  public apollo: ApolloClient<NormalizedCacheObject>;
  private outputLog;
  constructor() {
    this.outputLog = OutputLog.getInstance();
    this.apollo = this.createApollo();
  }
  public static getInstance(): ArtificialApollo {
    if (!ArtificialApollo.instance) {
      ArtificialApollo.instance = new ArtificialApollo();
    }
    return ArtificialApollo.instance;
  }
  private createApollo(): any {
    const configVals = ConfigValues.getInstance();
    const hostName = 'https://' + configVals.getHost() + '/graphql';
    const apiToken = configVals.getToken();

    const retryLink = new RetryLink({
      delay: {
        initial: 100,
        max: 2000,
        jitter: true,
      },
      attempts: {
        max: 3,
        retryIf: (error, _operation) => !!error,
      },
    });
    try {
      const httpLink = new HttpLink({
        uri: hostName,
        credentials: 'include',
        headers: {
          authorization: `Bearer ${apiToken}`,
          cookie: `artificial-org=${'artificial'}`,
        },
        fetch,
      });
      const timeoutLink = new ApolloLinkTimeout(3000);
      const timeoutHttpLink = timeoutLink.concat(httpLink);
      console.log('Hostname: ', hostName);
      this.apollo = new ApolloClient({
        link: from([retryLink, timeoutHttpLink]),
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
      vscode.window.showErrorMessage(`Exception creating apollo client ${err}`);
    }
  }

  public reset() {
    this.apollo.stop();
    this.apollo = this.createApollo();
  }

  private throwError = debounce((error: any) => {
    this.outputLog.log(`Problem connecting to Artificial, check token/config ${error} ${error.networkError.result}`);
    vscode.window.showErrorMessage(
      `Problem connecting to Artificial, check token/config ${error} ${error.networkError.result}`
    );
  }, 2000);

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
        this.throwError.cancel();
        return result.data;
      }
    } catch (err: any) {
      if (err.message === 'Timeout exceeded') {
        this.outputLog.log(`Timeout querying for workflows. Error:  ${err} ${err.networkError.result}`);
      } else {
        this.throwError(err);
      }
    }
  }

  public async queryAssistants(): Promise<AssistantReply | undefined> {
    try {
      if (!this.apollo) {
        console.error('ApolloClient missing.');
        return;
      }
      this.apollo.stop();
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
                id
                input
                index
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
        this.throwError.cancel();
        return result.data;
      }
    } catch (err: any) {
      if (err.message === 'Timeout exceeded') {
        this.outputLog.log(`Timeout querying for assistants. Error:  ${err} ${err.networkError.result}`);
      } else {
        this.throwError(err);
      }
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
        this.throwError.cancel();
        return result.data;
      }
    } catch (err: any) {
      if (err.message === 'Timeout exceeded') {
        this.outputLog.log(`Timeout querying for labs. Error:  ${err} ${err.networkError.result}`);
      } else {
        this.throwError(err);
      }
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
        this.throwError.cancel();
        return result.data;
      }
    } catch (err: any) {
      if (err.message === 'Timeout exceeded') {
        this.outputLog.log(`Timeout querying for configs. Error:  ${err} ${err.networkError.result}`);
      } else {
        this.throwError(err);
      }
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
        this.throwError.cancel();
        return result.data;
      }
    } catch (err: any) {
      if (err.message === 'Timeout exceeded') {
        this.outputLog.log(`Timeout querying for action. Error:  ${err} ${err.networkError.result}`);
      } else {
        this.throwError(err);
      }
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
      // TODO: Catch if a bad id is passed and nothing gets deleted
      if (result && result.data) {
        this.throwError.cancel();
        return result.data;
      }
    } catch (err: any) {
      if (err.message === 'Timeout exceeded') {
        this.outputLog.log(`Timeout deleting Action. Error:  ${err} ${err.networkError.result}`);
      } else {
        this.throwError(err);
      }
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
        this.throwError.cancel();

        return result.data;
      }
    } catch (err: any) {
      if (err.message === 'Timeout exceeded') {
        this.outputLog.log(`Timeout querying for org config. Error:  ${err} ${err.networkError.result}`);
      } else {
        this.throwError(err);
      }
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
        this.throwError.cancel();
        return result.data;
      }
    } catch (err: any) {
      if (err.message === 'Timeout exceeded') {
        this.outputLog.log(`Timeout querying for lab config. Error:  ${err} ${err.networkError.result}`);
      } else {
        this.throwError(err);
      }
    }
  }
}
