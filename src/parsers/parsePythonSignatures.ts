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
import { FunctionSignature, Param } from '../apis/types';

export class BuildPythonSignatures {
  build(actionPythonPath: string): FunctionSignature[] {
    if (pathExists(actionPythonPath)) {
      const pythonStubs = fs.readFileSync(actionPythonPath, 'utf-8');
      const signatureList: FunctionSignature[] = [];

      const buildSignature = (source: string) => {
        let ast = parse(source);

        return createVisitor({
          visitDecorated: (ast) => {
            const decoratorName = ast.decorators().decorator(0).dotted_name().text;
            if (decoratorName === 'action' || decoratorName === 'substrate_action') {
              const signature: FunctionSignature = { parameters: [], name: '', returnType: '' };
              signature.name = this.findFuncName(ast);
              signature.parameters = this.findParamNameAndType(ast);
              signature.returnType = ast?.async_funcdef()?.funcdef().test()?.text ?? '';
              signatureList.push(signature);
            }
          },
        }).visit(ast);
      };
      buildSignature(pythonStubs);
      return signatureList;
    } else {
      return [];
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
