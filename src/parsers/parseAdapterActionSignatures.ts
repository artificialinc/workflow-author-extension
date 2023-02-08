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
import { pathExists } from '../utils';
import { parse, createVisitor, DecoratedContext } from 'python-ast';

export class BuildPythonSignatures {
  async build(actionPythonPath: string): Promise<FileData | null> {
    if (pathExists(actionPythonPath)) {
      const pythonStubs = fs.readFileSync(actionPythonPath, 'utf-8');
      if (!pythonStubs) {
        return null;
      }
      const signatureList: FunctionSignature[] = [];
      const dataclassList: Dataclass[] = [];
      let adapterModule = '';

      const buildSignature = (source: string) => {
        let ast = parse(source);

        return createVisitor({
          visitDecorated: (ast) => {
            const signature: FunctionSignature = { parameters: [], name: '', returnType: '', module: 'Default' };
            const decoratorName = ast.decorators().decorator(0).dotted_name().text;
            // TODO: Can we remove substrate action here?
            if (decoratorName === 'action' || decoratorName === 'substrate_action') {
              const args = ast?.decorators()?.decorator(0)?.arglist()?.argument() ?? [];
              for (const arg of args) {
                if (arg.test(0).text === 'name') {
                  if (arg.test(1).text.indexOf('/') !== -1) {
                    signature.module = arg.test(1).text.split('/')[0].replace(new RegExp("'", 'g'), '');
                  }
                }
              }
              signature.name = this.findFuncName(ast);
              signature.parameters = this.findParamNameAndType(ast);
              signature.returnType = ast?.async_funcdef()?.funcdef().test()?.text ?? '';
              // TODO: Hacky
              if (signature.returnType.indexOf('.') !== -1) {
                signature.returnType = signature.returnType.split('.')[1];
              }
              signatureList.push(signature);
            } else if (decoratorName === 'dataclass') {
              const dataclass: Dataclass = { members: [], name: '' };
              dataclass.members = this.findDataClassMembers(ast);
              dataclass.name = ast.classdef()?.NAME().text ?? '';
              dataclassList.push(dataclass);
            }
          },
          visitFuncdef: (ast) => {
            // TODO: Hacky, maybe better way to specify and/or find module name
            const funcName = ast.NAME().text;
            if (funcName === '__init__') {
              const stmts = ast.suite().stmt();
              for (const stmt of stmts) {
                const text = stmt.text.replace(new RegExp("'", 'g'), '');
                if (text.match('super')) {
                  const module = text.split('"')[1];
                  if (module !== undefined) {
                    adapterModule = module;
                  }
                }
              }
            }
          },
        }).visit(ast);
      };
      buildSignature(pythonStubs);
      if (signatureList.length === 0 && dataclassList.length === 0 && adapterModule === '') {
        return null;
      }
      return { sigsAndTypes: { functions: signatureList, dataclasses: dataclassList }, module: adapterModule };
    } else {
      return null;
    }
  }

  private findFuncName(ast: DecoratedContext): string {
    return ast.async_funcdef()?.funcdef().NAME().text.cleanQuotes() ?? '';
  }

  private findParamNameAndType(ast: DecoratedContext): Param[] {
    const typeList = ast?.async_funcdef()?.funcdef().parameters().typedargslist();

    const params: Param[] = [];
    if (typeList) {
      for (let x = 0; x < typeList?.tfpdef().length; x++) {
        const argName = typeList?.tfpdef(x).NAME().text;
        let argType = typeList?.tfpdef(x).test()?.text ?? '';

        // TODO: Hacky split to just tear off t.
        if (argType.indexOf('.') !== -1) {
          argType = argType.split('.')[1];
        }

        params.push({ name: argName, type: argType });
      }
    }
    return params;
  }

  private findDataClassMembers(ast: DecoratedContext): Param[] {
    const statements = ast.classdef()?.suite().stmt();
    const params: Param[] = [];
    if (statements) {
      for (const statement of statements) {
        const name = statement.simple_stmt()?.small_stmt()[0].expr_stmt()?.testlist_star_expr()[0].text ?? '';
        let type = statement.simple_stmt()?.small_stmt()[0].expr_stmt()?.annassign()?.text ?? '';
        //Splits off the t.
        if (type.indexOf('.') !== -1) {
          type = type.split('.')[1];
          type = ': ' + type;
        }
        //Splits off the default values
        if (type.indexOf('=') !== -1) {
          type = type.split('=')[0];
        }
        params.push({ name: name, type: type });
      }
    }
    return params;
  }
}
