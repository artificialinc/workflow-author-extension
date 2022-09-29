export interface Token {
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
export interface Param {
  name: string;
  type: string;
}
export interface FunctionSignature {
  name: string;
  parameters: Param[];
  returnType: string;
}
