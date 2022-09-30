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

  provideFileDecoration(uri: Uri, token: CancellationToken): FileDecoration | undefined {
    const [, , status] = uri.path.split('/');

    switch (status) {
      case '!':
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
