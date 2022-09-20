import { ApolloClient, HttpLink, from, gql } from '@apollo/client/core';
import * as fs from 'fs';
import { RetryLink } from '@apollo/client/link/retry';
import { InMemoryCache } from '@apollo/client/cache/';
import fetch from 'cross-fetch';
import { parse } from 'yaml';
import * as path from 'path';
import * as vscode from 'vscode';

let rootPath =
  vscode.workspace.workspaceFolders &&
  vscode.workspace.workspaceFolders.length > 0
    ? vscode.workspace.workspaceFolders[0].uri.fsPath
    : undefined;
if (!rootPath) {
  vscode.window.showInformationMessage('No Root Path Found');
  rootPath = '';
}
// TODO: Move token and host name to configuration, pull from config.yaml
const configPath = path.join(rootPath, 'config.yaml');
const config = parse(fs.readFileSync(configPath, 'utf-8'));
const hostName = 'https://' + config.artificial.host + '/graphql';
const apiToken = config.artificial.token;

const retryLink = new RetryLink({
  delay: {
    initial: 100,
    max: 2000,
    jitter: true,
  },
  attempts: {
    max: 5,
    retryIf: (error, _operation) => !!error, // eslint-disable-line
  },
});
let apollo: any;
export function createApollo() {
  try {
    if (apollo) {
      console.log('Tried to create duplicate apollo client.');
      return apollo;
    }

    const httpLink = new HttpLink({
      uri: hostName,
      credentials: 'include',
      headers: {
        authorization: `Bearer ${apiToken}`,
        cookie: `artificial-org=${'artificial'}`,
      },
      fetch,
    });

    apollo = new ApolloClient({
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

    return apollo;
  } catch (err) {
    console.error('Exception creating apollo client.');
    console.log(JSON.stringify(err, null, 2));
  }
}

export async function queryWorkflows() {
  try {
    if (!apollo) {
      console.error('ApolloClient missing.');
      return;
    }
    const result = await apollo.query({
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
export async function queryAssistants() {
  try {
    if (!apollo) {
      console.error('ApolloClient missing.');
      return;
    }
    const result = await apollo.query({
      query: gql`
        query assistants {
          assistants {
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
