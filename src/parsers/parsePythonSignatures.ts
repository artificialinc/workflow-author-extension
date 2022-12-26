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
import {
  parse,
  createVisitor,
  DecoratedContext,
  SuiteContext,
  StmtContext,
  FuncdefContext,
  ParseTree,
} from 'python-ast';
import { FunctionSignature, Param } from '../apis/types';

export class BuildPythonSignatures {
  build(actionPythonPath: string): { signatures: FunctionSignature[]; module: string } {
    if (pathExists(actionPythonPath)) {
      const pythonStubs = fs.readFileSync(actionPythonPath, 'utf-8');
      const signatureList: FunctionSignature[] = [];
      let adapterModule = '';

      const buildSignature = (source: string) => {
        let ast = parse(source);

        return createVisitor({
          visitDecorated: (ast) => {
            const signature: FunctionSignature = { parameters: [], name: '', returnType: '', moduleName: '' };
            const decoratorName = ast.decorators().decorator(0).dotted_name().text;
            if (decoratorName === 'action' || decoratorName === 'substrate_action') {
              signature.name = this.findFuncName(ast);
              signature.parameters = this.findParamNameAndType(ast);
              signature.returnType = ast?.async_funcdef()?.funcdef().test()?.text ?? '';
              signatureList.push(signature);
            }
          },
          // visitVarargslist: (ast) => {
          //   console.log(ast.text);
          // },
          visitFuncdef: (ast) => {
            const funcName = ast.NAME().text;
            if (funcName === '__init__') {
              // const findModule = (ast: ParseTree) => {
              //   return createVisitor({
              //     // eslint-disable-next-line @typescript-eslint/naming-convention
              //     visitArglist: (ast) => {
              //       signature.moduleName = ast.text;
              //     },
              //   });
              // };
              // findModule(ast);

              for (let x = 0; x < ast.childCount; x++) {
                if (ast.getChild(x) instanceof SuiteContext) {
                  const body = ast.getChild(x) as SuiteContext;
                  for (let y = 0; y < body.childCount; y++) {
                    if (body.getChild(y) instanceof StmtContext) {
                      const text = body.getChild(y).text.replace(new RegExp("'", 'g'), '');
                      if (text.match('super')) {
                        const module = text.split('"')[1];
                        if (module !== undefined) {
                          adapterModule = module;
                        }
                      }
                    }
                  }
                }
              }
            }
          },
        }).visit(ast);
      };
      buildSignature(pythonStubs);

      return { signatures: signatureList, module: adapterModule };
    } else {
      return { signatures: [], module: '' };
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
        const argType = typeList?.tfpdef(x).test()?.text ?? '';

        params.push({ name: argName, type: argType });
      }
    }
    return params;
  }
}
