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
import { getAdapterClients as getAdapterClients, AdapterClient } from './grpc/grpc';
import * as grpc from '@grpc/grpc-js';
import * as vscode from 'vscode';
import { ConfigValues } from '../providers/configProvider';

export class ArtificialAdapter {
  adapterClients: Map<string, AdapterClient>;
  services: string[];
  remote: boolean = true;

  constructor(adapterClients: Map<string, AdapterClient>, remote: boolean = true) {
    this.adapterClients = adapterClients;
    this.services = [...adapterClients.keys()];
    this.remote = remote;
  }

  public static async createLocalAdapter<T extends typeof ArtificialAdapter>(this: T): Promise<InstanceType<T>> {
    const adapterClients = await getAdapterClients('localhost:5011', new grpc.Metadata(), false);
    return new this(adapterClients, false) as InstanceType<T>;
  }

  // Lab is tbd. Might be its own "manager lab" or something similar
  public static async createRemoteAdapter<T extends typeof ArtificialAdapter>(this: T, address: string, prefix: string, org: string, lab: string, token: string): Promise<InstanceType<T>> {
    const md = new grpc.Metadata();
    md.set("authorization", `Bearer ${token}`);
    md.set("forward-to", `${prefix}:${org}:${lab}:substrate`);
    var adapterClients: Map<string, AdapterClient>;
    adapterClients = await getAdapterClients(address, md, true);
    return new this(adapterClients, true) as InstanceType<T>;
  }

  public listActions(): string[] {
    let actions: string[] = [];
    this.services.forEach((service) => {
      actions = actions.concat(this.adapterClients.get(service)?.methods.map((method) => {
        return `${service}:${method}`;
      }) || []);
    });
    return actions;
  }

}

const LOCAL_SYMBOL = process.env.LOCAL_SYMBOL || 'manager.management_actions.ManagementActions';
const REMOTE_SYMBOL = process.env.REMOTE_SYMBOL || 'adapter.manager.management_actions.ManagementActions';

export class ArtificialAdapterManager extends ArtificialAdapter {
  public async updateAdapterImage(adapterName: string, image: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.adapterClients.get(this.remote ? REMOTE_SYMBOL : LOCAL_SYMBOL)?.client.updateAdapterImage({
        "adapter_name": { value: adapterName }, // eslint-disable-line @typescript-eslint/naming-convention
        "image": { value: image },
      }, (err: Error, _: any) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  public async listAdapters(): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const client = this.adapterClients.get(this.remote ? REMOTE_SYMBOL : LOCAL_SYMBOL)?.client;
      if (client && 'listAdapters' in client) {
        client.listAdapters({}, (err: Error, response: any) => {
          if (err) {
            reject(err);
          } else {
            // Filter out adapter_manager here
            resolve(response.value.filter((adapter: string) => adapter !== 'adapter_manager'));
          }
        });
      } else {
        reject(new Error('This adapter manager does not support listAdapters'));
      }
    });
  }
}
