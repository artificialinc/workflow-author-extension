import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Python3Parser } from 'dt-python-parser';
import { TokenType } from './tokens';
interface Token {
  _text: string | null;
  channel: number;
  column: number;
  line: number;
  start: number;
  stop: number;
  text: string;
  tokenIndex: number;
  type: number;
}
interface Param {
  name: string;
  type: string;
}
interface FunctionSignature {
  keywords: string[];
  name: string;
  parameters: Param[];
  returnType: string;
}
export class StubsProvider implements vscode.TreeDataProvider<AdapterFunction> {
  constructor(private workspaceRoot: string) {}
  private _onDidChangeTreeData: vscode.EventEmitter<
    AdapterFunction | undefined | null | void
  > = new vscode.EventEmitter<AdapterFunction | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    AdapterFunction | undefined | null | void
  > = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  generateStubs(): any {
    if (!vscode.workspace.workspaceFolders) {
      return vscode.window.showErrorMessage(
        'Please open a project folder first'
      );
    }
    const folderPath = vscode.workspace.workspaceFolders[0].uri
      .toString()
      .split(':')[1];

    let funcSigs: FunctionSignature[] = [];
    const actionPythonPath = path.join(
      this.workspaceRoot,
      'adapter',
      'actions.py'
    );
    if (this.pathExists(actionPythonPath)) {
      funcSigs = this.buildPythonFunctionSignatures(actionPythonPath);
    } else {
      vscode.window.showInformationMessage('Workspace has no actions.py');
      return Promise.resolve([]);
    }

    let pythonContent = `# GENERATED FILE: DO NOT EDIT BY HAND
# REGEN USING EXTENSION
from artificial.workflows.decorators import return_parameter, substrate_action`;
    pythonContent = pythonContent.concat('\n');
    pythonContent = pythonContent.concat('\n');
    for (const sig of funcSigs) {
      pythonContent = pythonContent.concat('\n');
      pythonContent = pythonContent.concat(
        "@substrate_action('",
        sig.name,
        '\', display_name="',
        sig.name,
        '")'
      );
      pythonContent = pythonContent.concat('\n');
      pythonContent = pythonContent.concat('@return_parameter("TODO")');
      pythonContent = pythonContent.concat('\n');
      //TODO: loop keywords here, this is assuming always async def
      let functionString =
        sig.keywords[0] + ' ' + sig.keywords[1] + ' ' + sig.name + '(';
      let iterations = sig.parameters.length;
      for (let param of sig.parameters) {
        --iterations;
        if (param.name !== 'self' && param.type !== 'ActionContext') {
          functionString += param.name;
          functionString += ': ';
          functionString += param.type;
          // This takes care of trailing comma after last param
          if (iterations) {
            functionString += ', ';
          }
        }
      }

      functionString += ')';
      if (sig.returnType !== '') {
        functionString += ' -> ';
        functionString += sig.returnType;
      }
      functionString += ':';
      pythonContent = pythonContent.concat(functionString);
      pythonContent = pythonContent.concat('\n');
      pythonContent = pythonContent.concat('    pass');
      pythonContent = pythonContent.concat('\n');
      pythonContent = pythonContent.concat('\n');
    }

    fs.writeFile(
      path.join(folderPath, 'workflow', 'stubs_actions.py'),
      pythonContent,
      (err) => {
        if (err) {
          return vscode.window.showErrorMessage(
            'Failed to create boilerplate file!'
          );
        }
        vscode.window.showInformationMessage('Created boilerplate files');
      }
    );
  }

  getTreeItem(element: AdapterFunction): vscode.TreeItem {
    return element;
  }

  getChildren(element?: AdapterFunction): Thenable<AdapterFunction[]> {
    if (!this.workspaceRoot) {
      vscode.window.showInformationMessage('No dependency in empty workspace');
      return Promise.resolve([]);
    }

    if (element) {
      return Promise.resolve(
        this.getFuncsInActionPython(
          path.join(this.workspaceRoot, 'adapters', 'actions.py')
        )
      );
    } else {
      const actionPythonPath = path.join(
        this.workspaceRoot,
        'adapter',
        'actions.py'
      );
      if (this.pathExists(actionPythonPath)) {
        return Promise.resolve(this.getFuncsInActionPython(actionPythonPath));
      } else {
        vscode.window.showInformationMessage('Workspace has no actions.py');
        return Promise.resolve([]);
      }
    }
  }

  findTokenIndex(
    tokens: Token[],
    type: TokenType,
    startIndex: number,
    endIndex: number = -1
  ): number {
    if (endIndex !== -1) {
      return tokens.findIndex(
        (token, index) =>
          index > startIndex && index < endIndex && token.type === type
      );
    } else {
      return tokens.findIndex(
        (token, index) => index > startIndex && token.type === type
      );
    }
  }

  buildPythonParams(
    tokens: Token[],
    paramStartIdx: number,
    paramEndIdx: number
  ): Param[] {
    let paramName = '';
    let paramType = '';
    let typevsname = 'name';
    let params = [];
    for (let index = paramStartIdx; index <= paramEndIdx; index++) {
      if (tokens[index].type === TokenType.COLON) {
        typevsname = 'type';
      } else if (
        tokens[index].type === TokenType.COMMA ||
        tokens[index].type === TokenType.CLOSE_PAREN
      ) {
        let param: Param = { name: paramName, type: paramType };
        params.push(param);
        paramName = '';
        paramType = '';
        typevsname = 'name';
      } else if (typevsname === 'name') {
        paramName += tokens[index].text;
      } else if (typevsname === 'type') {
        paramType += tokens[index].text;
      }
    }
    return params;
  }

  private buildPythonFunctionSignatures(
    actionPythonPath: string
  ): FunctionSignature[] {
    if (this.pathExists(actionPythonPath)) {
      const packageJson = fs.readFileSync(actionPythonPath, 'utf-8');
      const parser = new Python3Parser();
      const tokens: Token[] = parser.getAllTokens(packageJson);
      const functionSignatures: FunctionSignature[] = [];
      // @action()
      // async def create_plate(self, actx: ActionContext, barcode: str) -> t.Dict:
      // Look for @ and verify the name is action.  Then continue to find function def
      // Find function start by looking for async keyword
      // Find params beginning by first open paren
      // Find params end by first closing paren
      // Find func end by first : AFTER closing parens
      // Find Return arrow IF it exists by looking between closing paren and :
      for (const [idx, token] of tokens.entries()) {
        if (token.type === TokenType.AT && tokens[idx + 1].text === 'action') {
          const funcStartIdx = this.findTokenIndex(
            tokens,
            TokenType.ASYNC, //TODO: Assumption, always async?
            idx
          );
          const openParenIdx = this.findTokenIndex(
            tokens,
            TokenType.OPEN_PAREN,
            funcStartIdx
          );
          const closeParenIdx = this.findTokenIndex(
            tokens,
            TokenType.CLOSE_PAREN, //TODO: Assumption, no parens in params
            funcStartIdx
          );
          const funcEndIdx = this.findTokenIndex(
            tokens,
            TokenType.COLON,
            closeParenIdx
          );
          const returnArrowIdx = this.findTokenIndex(
            tokens,
            TokenType.ARROW,
            closeParenIdx,
            funcEndIdx
          );

          let functionSignature: FunctionSignature = {
            keywords: [],
            name: '',
            parameters: [],
            returnType: '',
          };
          functionSignature.keywords.push(tokens[funcStartIdx].text);
          functionSignature.keywords.push(tokens[funcStartIdx + 1].text);
          functionSignature.name = tokens[funcStartIdx + 2].text;
          if (returnArrowIdx !== -1) {
            for (let x = returnArrowIdx + 1; x < funcEndIdx; x++) {
              functionSignature.returnType += tokens[x].text;
            }
          }
          functionSignature.parameters = this.buildPythonParams(
            tokens,
            openParenIdx + 1,
            closeParenIdx
          );
          functionSignatures.push(functionSignature);
        }
      }
      return functionSignatures;
    } else {
      return [];
    }
  }

  /**
   * Given the path to package.json, read all its dependencies and devDependencies.
   */
  private getFuncsInActionPython(actionPythonPath: string): AdapterFunction[] {
    const functionSignatures =
      this.buildPythonFunctionSignatures(actionPythonPath);
    const adapterFunctions = functionSignatures.map(
      (funcName: FunctionSignature): AdapterFunction => {
        return new AdapterFunction(
          funcName.name,
          vscode.TreeItemCollapsibleState.None
        );
      }
    );

    return adapterFunctions;
  }

  private pathExists(p: string): boolean {
    try {
      fs.accessSync(p);
    } catch (err) {
      return false;
    }
    return true;
  }
}

class AdapterFunction extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsibleState);
    this.tooltip = `${this.label}`;
  }

  iconPath = {
    light: path.join(
      __filename,
      '..',
      '..',
      'resources',
      'light',
      'dependency.svg'
    ),
    dark: path.join(
      __filename,
      '..',
      '..',
      'resources',
      'dark',
      'dependency.svg'
    ),
  };
}
