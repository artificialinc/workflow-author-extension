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

import * as fs from 'fs';
import * as vscode from 'vscode';

export function pathExists(p: string): boolean {
  try {
    fs.accessSync(p);
  } catch (err) {
    return false;
  }
  return true;
}

String.prototype.cleanQuotes = function (): string {
  return this.replace(new RegExp('\'|"', 'g'), '');
};

export function findOrCreateTerminal(showTerminal: boolean = false): vscode.Terminal {
  let terminal = undefined;
  for (const term of vscode.window.terminals) {
    if (term.name === 'Artificial-WF-Terminal') {
      terminal = term;
    }
  }
  if (!terminal) {
    terminal = vscode.window.createTerminal(`Artificial-WF-Terminal`);
  }
  if (showTerminal) {
    terminal.show();
  }
  return terminal;
}
