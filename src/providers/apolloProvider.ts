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

import { ApolloClient, HttpLink, from, gql, ApolloError, ServerError } from '@apollo/client/core';
import { RetryLink } from '@apollo/client/link/retry';
import { InMemoryCache, NormalizedCacheObject } from '@apollo/client/cache/';
import fetch from 'cross-fetch';
import { ConfigValues } from './configProvider';
import { OutputLog } from './outputLogProvider';
import * as vscode from 'vscode';
import { debounce } from 'lodash';
import { unescape } from 'validator';
export interface LabReply {
  labs: [{ name: string; id: string }];
}
export interface ConfigReply {
  labs: [{ id: string; name: string; loadingConfigs: [{ id: string; name: string }] }];
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
    },
  ];
}
export interface AssistantTypeInfo {
  name: string;
  type: string;
  subTypes: [
    {
      type: string;
    },
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
  private createApollo(): ApolloClient<NormalizedCacheObject> {
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
      console.log('Hostname: ', hostName);
      this.apollo = new ApolloClient({
        link: from([retryLink, httpLink]),
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
      throw new Error(`Exception creating apollo client ${err}`);
    }
  }

  public reset() {
    this.apollo.stop();
    this.apollo = this.createApollo();
  }

  private errorHandler(err: unknown) {
    if (err instanceof ApolloError) {
      const networkError = err.networkError as ServerError | undefined;
      if (networkError) {
        this.throwError(networkError);
      } else {
        this.outputLog.log(`Error during gql query:  ${err}`);
      }
    } else {
      this.outputLog.log(`Non-apollo error during gql query:  ${err}`);
    }
  }

  private throwError = debounce((error: ServerError) => {
    const configVals = ConfigValues.getInstance();
    this.outputLog.log(
      `Problem connecting to ${configVals.getHost()}, Status Code: ${error.statusCode} Result: ${error.result}  Error: ${error}`,
    );
    switch (error.statusCode) {
      case 401:
        vscode.window.showErrorMessage(`Artificial: Unauthorized: ${error.result}`);
        break;
      case 403:
        vscode.window.showErrorMessage(`Artificial: Forbidden: ${error.result}`);
        break;
      case 404:
        vscode.window.showErrorMessage(`Artificial: Not Found: ${error.result}`);
        break;
      case 408:
        vscode.window.showErrorMessage(`Artificial: Timeout: ${error.result}`);
        break;
      case 500:
        vscode.window.showErrorMessage(`Artificial: Internal Server Error: ${error.result}`);
        break;
      case 503:
        vscode.window.showErrorMessage(`Artificial: No upstream: ${error.result}`);
        break;
      default:
        vscode.window.showErrorMessage(
          `Problem connecting to ${configVals.getHost()}, Status Code: ${error.statusCode} Result: ${error.result}`,
        );
        break;
    }
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
    } catch (err) {
      this.errorHandler(err);
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
    } catch (err) {
      this.errorHandler(err);
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
        // Unescape each lab name
        const unescapedLabs = result.data.labs.map((lab: {name: string, id: string}) => ({
          ...lab,
          name: unescape(lab.name),
        }));
        return {
          ...result.data,
          labs: unescapedLabs,
        };
      }
    } catch (err) {
      this.errorHandler(err);
    }
  }
  public async queryConfigs(): Promise<ConfigReply | undefined> {
    try {
      if (!this.apollo) {
        console.error('ApolloClient missing.');
        return;
      }
      const result = await this.apollo.query({
        query: gql`
          query loadconfigs {
            labs {
              id
              name
              loadingConfigs {
                id
                name
              }
            }
          }
        `,
      });

      if (result && result.data) {
        this.throwError.cancel();
        return result.data;
      }
    } catch (err) {
      this.errorHandler(err);
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
    } catch (err) {
      this.errorHandler(err);
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
    } catch (err) {
      this.errorHandler(err);
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
    } catch (err) {
      this.errorHandler(err);
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
    } catch (err) {
      this.errorHandler(err);
    }
  }
}
