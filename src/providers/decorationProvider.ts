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

import type { CancellationToken, Event, FileDecoration, FileDecorationProvider, Uri } from 'vscode';
import { Disposable, EventEmitter, ThemeColor, window } from 'vscode';

export class ViewFileDecorationProvider implements FileDecorationProvider {
  private readonly _onDidChange = new EventEmitter<undefined | Uri | Uri[]>();
  get onDidChange(): Event<undefined | Uri | Uri[]> {
    return this._onDidChange.event;
  }
  private readonly disposable: Disposable;
  constructor() {
    this.disposable = Disposable.from(window.registerFileDecorationProvider(this));
  }

  provideFileDecoration(uri: Uri, _token: CancellationToken): FileDecoration | undefined {
    const [, , status] = uri.path.split('/');

    switch (status) {
      case 'typeError':
        return {
          badge: '!!',
          color: new ThemeColor('artificial.typeError'),
          tooltip: 'Ignored',
        };
      default:
        return undefined;
    }
  }
}
