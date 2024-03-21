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
import { getAdapterClients as getAdapterClients, AdapterClient, getRemoteScope, UnimplementedError } from './grpc/grpc';
import * as grpc from '@grpc/grpc-js';
import { OutputLog } from '../providers/outputLogProvider';


const LOCAL_SYMBOL = process.env.LOCAL_SYMBOL || 'manager.management_actions.ManagementActions';
const REMOTE_SYMBOL = process.env.REMOTE_SYMBOL || 'adapter.manager.management_actions.ManagementActions';

export interface Output {
  log: (value: string) => void;
}

export class ArtificialAdapter {
  adapterClients: Map<string, AdapterClient>;
  services: string[];
  output: Output;

  constructor(adapterClients: Map<string, AdapterClient>, output: Output = OutputLog.getInstance()) {
    this.adapterClients = adapterClients;
    this.services = [...adapterClients.keys()];
    this.output = output;
  }

  public static async createLocalAdapter<T extends typeof ArtificialAdapter>(this: T, output: Output = OutputLog.getInstance()): Promise<InstanceType<T>> {
    const adapterClients = await getAdapterClients('localhost:5011', new grpc.Metadata(), false);
    return new this(adapterClients, output) as InstanceType<T>;
  }

  // Lab is tbd. Might be its own "manager lab" or something similar
  public static async createRemoteAdapter<T extends typeof ArtificialAdapter>(this: T, address: string, prefix: string, org: string, lab: string, token: string, output: Output = OutputLog.getInstance()): Promise<InstanceType<T>> {
    try {
      OutputLog.getInstance().log('Attempting to get remote scope');
      const remoteScope = await getRemoteScope(address, lab, token);
      OutputLog.getInstance().log(`Got remote scope: ${remoteScope.namespace}:${remoteScope.orgId}:${remoteScope.labId}`);
      prefix = remoteScope.namespace;
      org = remoteScope.orgId;
      lab = remoteScope.labId;
    } catch (e) {
      if (e instanceof UnimplementedError) {
        OutputLog.getInstance().log('Labmanager does not support getScope method, falling back to local namespace/org');
      } else {
        throw e;
      }
    }

    const md = new grpc.Metadata();
    md.set("authorization", `Bearer ${token}`);
    md.set("forward-to", `${prefix}:${org}:${lab}:substrate`);
    var adapterClients: Map<string, AdapterClient>;
    adapterClients = await getAdapterClients(address, md, true);
    return new this(adapterClients, output) as InstanceType<T>;
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

  public getManagementClient(): AdapterClient {
    // Try the two ways these things seem to get registered. At least until we fully standardize
    if (this.adapterClients.has(LOCAL_SYMBOL)) {
      return this.adapterClients.get(LOCAL_SYMBOL)!;
    } else if (this.adapterClients.has(REMOTE_SYMBOL)) {
      return this.adapterClients.get(REMOTE_SYMBOL)!;
    } else {
      this.output.log('Could not find management client, available clients are: ' + Array.from(this.adapterClients.keys()).join(', '));
      throw new Error('Could not find adapter manager client');
    }
  }
}


export type AdapterInfo = {
  name: string;
  image: string;
  is_manager: boolean; // eslint-disable-line @typescript-eslint/naming-convention
};

export class ArtificialAdapterManager extends ArtificialAdapter {
  public async updateAdapterImage(adapterName: string, image: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.getManagementClient().client.updateAdapterImage({
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


  public async listNonManagerAdapters(): Promise<AdapterInfo[]> {
    return new Promise((resolve, reject) => {
      const client = this.getManagementClient().client;
      if (client && 'listAdapters' in client) {
        client.listAdapters({}, (err: Error, response: any) => {
          if (err) {
            reject(err);
          } else {
            // Filter out adapter_manager here
            resolve(response.value.filter((adapter: AdapterInfo) => !adapter.is_manager));
          }
        });
      } else {
        this.output.log('This adapter manager does not support listAdapters. Available clients are: ' + Array.from(client.keys()).join(', '));
        reject(new Error('This adapter manager does not support listAdapters'));
      }
    });
  }
}
