export interface Param {
  name: string;
  type: string;
}
export interface FunctionSignature {
  name: string;
  parameters: Param[];
  returnType: string;
}
