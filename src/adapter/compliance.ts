/*
Copyright 2023 Artificial, Inc.

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
import { ComplianceModeServiceClient } from '@artificial/artificial-protos/grpc-js/artificial/api/alab/compliance/v1/mode_grpc_pb';
import * as grpc from '@grpc/grpc-js';
import { credsConstructor } from './grpc/grpc';

export class Compliance {
  client: ComplianceModeServiceClient;

  constructor(client: ComplianceModeServiceClient) {
    this.client = client;
  }

  // public static async create(address: string, prefix: string, org: string, lab: string, token: string): Promise<Labmanager> {
  public static create(address: string, token: string, ssl: boolean): Compliance {
    const md = new grpc.Metadata();
    md.set('authorization', `Bearer ${token}`);
    const creds = credsConstructor(md, ssl);
    return new Compliance(new ComplianceModeServiceClient(address, creds()));
  }
}

export function complianceClientConstructor(address: string, token: string, ssl: boolean): ComplianceModeServiceClient {
  const md = new grpc.Metadata();
  md.set('authorization', `Bearer ${token}`);
  const creds = credsConstructor(md, ssl);
  return new ComplianceModeServiceClient(address, creds());
}
