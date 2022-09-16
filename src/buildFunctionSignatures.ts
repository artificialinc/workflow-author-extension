import * as fs from 'fs';
import { Python3Parser } from 'dt-python-parser';
import { TokenType } from './tokens';
import { pathExists } from './utils';
import { Token, FunctionSignature, Param } from './types';

export function buildPythonFunctionSignatures(
  actionPythonPath: string
): FunctionSignature[] {
  if (pathExists(actionPythonPath)) {
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
        const funcStartIdx = findTokenIndex(
          tokens,
          TokenType.ASYNC, //TODO: Assumption, always async?
          idx
        );
        const openParenIdx = findTokenIndex(
          tokens,
          TokenType.OPEN_PAREN,
          funcStartIdx
        );
        const closeParenIdx = findTokenIndex(
          tokens,
          TokenType.CLOSE_PAREN, //TODO: Assumption, no parens in params
          funcStartIdx
        );
        const funcEndIdx = findTokenIndex(
          tokens,
          TokenType.COLON,
          closeParenIdx
        );
        const returnArrowIdx = findTokenIndex(
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
        functionSignature.parameters = buildPythonParams(
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
function findTokenIndex(
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

function buildPythonParams(
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
