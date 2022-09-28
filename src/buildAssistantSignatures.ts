import * as fs from 'fs';
import { pathExists } from './utils';
import { parse, createVisitor, DecoratedContext } from 'python-ast';

export interface AssistantSignature {
  actionId?: string;
  params?: Param[];
  funcdef?: string;
}
interface Param {
  name?: string;
  type?: string;
  assistantName?: string;
}

export class BuildAssistantSignatures {
  build(actionPythonPath: string): AssistantSignature[] {
    if (pathExists(actionPythonPath)) {
      const packageJson = fs.readFileSync(actionPythonPath, 'utf-8');
      const signatureList: AssistantSignature[] = [];

      const buildSignature = (source: string) => {
        let ast = parse(source);

        return createVisitor({
          visitDecorated: (ast) => {
            if (ast.decorators().decorator(0).dotted_name().text === 'assistant') {
              const signature: AssistantSignature = {};
              signature.actionId = ast
                .decorators()
                .decorator(0)
                .arglist()
                ?.argument(0)
                .test(0)
                .text.replace(new RegExp("'", 'g'), '');
              signature.funcdef = ast.async_funcdef()?.funcdef().NAME().text.replace(new RegExp("'", 'g'), '') ?? '';
              const paramList: Param[] = [];
              for (let x = 1; x < ast.decorators().decorator().length; x++) {
                if (ast.decorators().decorator(x).dotted_name().text === 'parameter') {
                  const paramName = ast
                    .decorators()
                    .decorator(x)
                    .arglist()
                    ?.argument(0)
                    .test(0)
                    .text.replace(new RegExp("'", 'g'), '');
                  const assistantName = ast.decorators().decorator(x).arglist()?.argument(1).test(1).text;
                  let type = '';
                  if (paramName) {
                    type = this.findParamType(paramName, ast);
                  }
                  paramList.push({ type: type, assistantName: assistantName, name: paramName });
                }
              }
              signature.params = paramList;
              signatureList.push(signature);
            }
          },
        }).visit(ast);
      };
      buildSignature(packageJson);
      return signatureList;
    } else {
      return [];
    }
  }
  findParamType(paramName: string, ast: DecoratedContext): string {
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
