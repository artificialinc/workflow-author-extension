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
import { addFileToContext } from '../utils';
import { OutputLog } from '../providers/outputLogProvider';

type DeploymentConfig = {
  artificial: {
    host: string;
    token: string;
    labId?: string;
  };
};

export async function authExternalUriRegistration(context: vscode.ExtensionContext) {
  // Register a URI handler for the authentication callback
  vscode.window.registerUriHandler({
    handleUri(uri: vscode.Uri): vscode.ProviderResult<void> {
      if (uri.path === '/auth-complete') {
        // Parse query parameters
        const query = new URLSearchParams(uri.query);
        const instanceURL = query.get('instanceURL');
        const token = query.get('token');

        if (instanceURL === null || token === null) {
          vscode.window.showErrorMessage('Sign in failed: missing instanceURL or token');
          return;
        }
        // Convert instanceURL into a valid host for AC
        const u = new URL(instanceURL);

        const generatedObj: DeploymentConfig = {
          artificial: {
            host: u.host,
            token: token,
          },
        };

        const labId = query.get('labId');

        if (labId !== null) {
          generatedObj.artificial.labId = labId;
        } else {
          vscode.window.showWarningMessage(
            'Warning: no lab selected. Please select a lab before running or deploying.'
          );
        }

        addFileToContext(JSON.stringify(generatedObj), 'generated.yaml');

        vscode.window.showInformationMessage(
          `Sign in successful!. Please make sure generated.yaml is added to your .gitignore file`
        );
      } else {
        vscode.window.showErrorMessage(`Sign in failed: invalid URI path ${uri.path}`);
      }
    },
  });

  // Register a sign in command
  context.subscriptions.push(
    vscode.commands.registerCommand(`adapterActions.signin`, async () => {
      // Ask for instance url
      const rawInstanceUrl = await vscode.window.showInputBox({
        prompt: 'Enter the URL of your instance',
        placeHolder: 'https://example.artificial.com',
      });

      if (rawInstanceUrl === undefined) {
        vscode.window.showErrorMessage('Sign in failed: missing instance URL');
        return;
      }

      try {
        new URL(rawInstanceUrl);
      } catch (e) {
        const log = OutputLog.getInstance();
        log.log(`Error getting instance url during signin: ${e}`);
        vscode.window.showErrorMessage(`Sign in failed: invalid instance URL`);
        return;
      }

      const instanceUrl = new URL(rawInstanceUrl);

      // Get an externally addressable callback URI for the handler that the authentication provider can use
      const extensionId = 'artificial.artificial-workflow-extension';
      const callbackUri = await vscode.env.asExternalUri(
        vscode.Uri.parse(`${vscode.env.uriScheme}://${extensionId}/auth-complete`)
      );
      const authUri = vscode.Uri.parse(
        `${instanceUrl.origin}${instanceUrl.pathname}#/vscode-login?instanceURL=${encodeURIComponent(
          instanceUrl.href
        )}&redirect=${encodeURIComponent(callbackUri.toString())}`
      );
      vscode.env.openExternal(authUri);
    })
  );
}
