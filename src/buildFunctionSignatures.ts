import * as fs from 'fs';
import { Python3Parser, Python3Visitor } from 'dt-python-parser';
import { TokenType } from './tokenTypes';
import { pathExists } from './utils';
import { Token, FunctionSignature, Param } from './types';

export class BuildFunctionSignatures {
  build(actionPythonPath: string): FunctionSignature[] {
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
        if (
          token.type === TokenType.AT &&
          (tokens[idx + 1].text === 'substrate_action' ||
            tokens[idx + 1].text === 'assistant' ||
            tokens[idx + 1].text === 'action')
        ) {
          const funcStartIdx = this.findTokenIndex(
            tokens,
            TokenType.ASYNC, //TODO: Assumption, always async?
            idx
          );
          const openParenIdx = this.findTokenIndex(tokens, TokenType.OPEN_PAREN, funcStartIdx);
          const closeParenIdx = this.findClosedParenIndex(tokens, openParenIdx);

          const funcEndIdx = this.findTokenIndex(tokens, TokenType.COLON, closeParenIdx);
          const returnArrowIdx = this.findTokenIndex(tokens, TokenType.ARROW, closeParenIdx, funcEndIdx);

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
          functionSignature.parameters = this.buildPythonParams(tokens, openParenIdx + 1, closeParenIdx);
          functionSignatures.push(functionSignature);
        }
      }
      return functionSignatures;
    } else {
      return [];
    }
  }
  private findClosedParenIndex(tokens: Token[], startIndex: number): number {
    let index = startIndex;
    let openParens = 1;
    while (openParens >= 1) {
      index += 1;
      if (tokens[index].type === TokenType.OPEN_PAREN) {
        openParens += 1;
      }
      if (tokens[index].type === TokenType.CLOSE_PAREN) {
        openParens -= 1;
      }
    }
    return index;
  }
  private findTokenIndex(tokens: Token[], type: TokenType, startIndex: number, endIndex: number = -1): number {
    if (endIndex !== -1) {
      return tokens.findIndex((token, index) => index > startIndex && index < endIndex && token.type === type);
    } else {
      return tokens.findIndex((token, index) => index > startIndex && token.type === type);
    }
  }
  private buildPythonParams(tokens: Token[], paramStartIdx: number, paramEndIdx: number): Param[] {
    let paramName = '';
    let paramType = '';
    let typevsname = 'name';
    let params = [];
    let innerScope = 0;
    for (let index = paramStartIdx; index <= paramEndIdx; index++) {
      if (
        tokens[index].type === TokenType.OPEN_PAREN ||
        tokens[index].type === TokenType.OPEN_BRACK ||
        tokens[index].type === TokenType.OPEN_BRACE
      ) {
        innerScope += 1;
      }
      if (
        tokens[index].type === TokenType.CLOSE_PAREN ||
        tokens[index].type === TokenType.CLOSE_BRACK ||
        tokens[index].type === TokenType.CLOSE_BRACE
      ) {
        innerScope -= 1;
      }
      if (tokens[index].type === TokenType.COLON) {
        typevsname = 'type';
      } else if ((tokens[index].type === TokenType.COMMA || index === paramEndIdx) && innerScope <= 0) {
        //HACK: Handles trailing comma before the final closing brace
        if (paramName !== '') {
          let param: Param = { name: paramName, type: paramType };
          params.push(param);
          paramName = '';
          paramType = '';
          typevsname = 'name';
        }
      } else if (typevsname === 'name') {
        paramName += tokens[index].text;
      } else if (typevsname === 'type') {
        paramType += tokens[index].text;
      }
    }
    return params;
  }
}
