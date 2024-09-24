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
import { GetConnectionsRequest } from "@artificial/artificial-protos/grpc-js/artificial/api/labmanager/v1/labmanager_service_pb";
import { LabmanagerClient, getLabmanagerClient } from "./grpc/grpc";
import * as grpc from '@grpc/grpc-js';

export class Labmanager {
  client: LabmanagerClient;
  prefix: string;
  org: string;
  lab: string;

  constructor(labmanagerClient: LabmanagerClient, prefix: string, org: string, lab: string) {
    this.client = labmanagerClient;
    this.prefix = prefix;
    this.org = org;
    this.lab = lab;
  }

  public static async create(address: string, prefix: string, org: string, lab: string, token: string): Promise<Labmanager> {
    const md = new grpc.Metadata();
    md.set("authorization", `Bearer ${token}`);
    const client = await getLabmanagerClient(address, md);
    return new Labmanager(client, prefix, org, lab);
  }

  /**
   * getAdapters
   * @description This uses a labmanager endpoint to get a list of adapters. This may contain adapters that are not able to be updated
   * with the adapter manager
   * @returns a list of adapters
   */
  public async getAdapters(): Promise<string[]> {
    return new Promise<string[]>((resolve, reject) => {
      this.client.getConnections(new GetConnectionsRequest().setScope(`${this.prefix}:${this.org}:${this.lab}:`), (err, res) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(res.getConnectionsList().map((c) => c.getClient()?.getName() || "unknown name"));
      });
    });
  }
}
