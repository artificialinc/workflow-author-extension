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

interface String {
  cleanQuotes(): string;
}

interface Param {
  name: string;
  type: string;
}
interface FunctionSignature {
  name: string;
  parameters: Param[];
  returnType: string;
  module: string;
}

export interface FunctionsAndDataclasses {
  functions: FunctionSignature[];
  dataclasses: Dataclass[];
}

export interface Dataclass {
  name: string;
  members: Param[];
}

export interface FileData {
  module: string;
  sigsAndTypes: FunctionsAndDataclasses;
}

interface AssistantSignature {
  actionId: string;
  parameters: AssistantParam[];
  name: string;
}

interface AssistantParam {
  name: string;
  type: string;
  assistantName: string;
}

interface AssistantTypeError {
  code: number;
  error: string;
}
