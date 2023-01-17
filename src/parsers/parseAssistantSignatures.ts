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

export class BuildAssistantSignatures {
  build(actionPythonPath: string): AssistantSignature[] {
    if (pathExists(actionPythonPath)) {
      const asstStubs = fs.readFileSync(actionPythonPath, 'utf-8');
      const signatureList: AssistantSignature[] = [];

      const buildSignature = (source: string) => {
        let ast = parse(source);

        return createVisitor({
          visitDecorated: (ast) => {
            if (ast.decorators().decorator(0).dotted_name().text === 'assistant') {
              const signature: AssistantSignature = { actionId: '', parameters: [], name: '' };
              signature.actionId = signature.name = this.findActionId(ast);
              signature.name = this.findFuncName(ast);
              signature.parameters = this.findAssistantParams(ast);
              signatureList.push(signature);
            }
          },
        }).visit(ast);
      };
      buildSignature(asstStubs);
      return signatureList;
    } else {
      return [];
    }
  }

  private findAssistantParams(ast: DecoratedContext): AssistantParam[] {
    const paramList: AssistantParam[] = [];
    for (let x = 1; x < ast.decorators().decorator().length; x++) {
      if (ast.decorators().decorator(x).dotted_name().text === 'parameter') {
        const paramName = this.findName(ast, x, 0);
        const assistantName = this.findName(ast, x, 1);

        let type = '';
        if (paramName) {
          type = this.findParamType(paramName, ast);
        }
        paramList.push({ type: type, assistantName: assistantName, name: paramName });
      }
    }
    return paramList;
  }

  private findActionId(ast: DecoratedContext): string {
    return ast.decorators().decorator(0).arglist()?.argument(0).test(0).text.cleanQuotes() ?? '';
  }

  private findFuncName(ast: DecoratedContext): string {
    return ast.async_funcdef()?.funcdef().NAME().text.cleanQuotes() ?? '';
  }

  private findName(ast: DecoratedContext, index: number, element: number): string {
    return ast.decorators().decorator(index).arglist()?.argument(element).test(element).text.cleanQuotes() ?? '';
  }

  private findParamType(paramName: string, ast: DecoratedContext): string {
    const typeList = ast?.async_funcdef()?.funcdef().parameters().typedargslist();
    if (typeList) {
      for (let x = 0; x < typeList?.tfpdef().length; x++) {
        const argName = typeList?.tfpdef(x).NAME().text;
        const argType = typeList?.tfpdef(x).test()?.text ?? '';
        if (argName === paramName) {
          return argType;
        }
      }
    }
    return '';
  }
}
