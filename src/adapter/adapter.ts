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
import { Compliance, complianceClientConstructor } from './compliance';
import { ComplianceModeServiceClient, IComplianceModeServiceClient } from '@artificial/artificial-protos/grpc-js/artificial/api/alab/compliance/v1/mode_grpc_pb';
import { ComplianceModeState, GetComplianceModeRequest, GetComplianceModeResponse } from '@artificial/artificial-protos/grpc-js/artificial/api/alab/compliance/v1/mode_pb';
import { AdapterServiceClient } from '@artificial/artificial-protos/grpc-js/artificial/api/alab/adapter/v1/adapter_grpc_pb';
import * as semver from 'semver';
import { GetAdapterRequest, GetAdapterResponse, ListAdaptersRequest, ListAdaptersResponse, UpdateAdapterImageRequest } from '@artificial/artificial-protos/grpc-js/artificial/api/alab/adapter/v1/adapter_pb';
import { reject } from 'lodash';

const LOCAL_SYMBOL = process.env.LOCAL_SYMBOL || 'manager.management_actions.ManagementActions';
const REMOTE_SYMBOL = process.env.REMOTE_SYMBOL || 'adapter.manager.management_actions.ManagementActions';

export interface Output {
  log: (value: string) => void;
}

export class ArtificialAdapter {
  adapterClients: Map<string, AdapterClient>;
  complianceClient?: ComplianceModeServiceClient;
  services: string[];
  output: Output;

  constructor(adapterClients: Map<string, AdapterClient>, compliance?: ComplianceModeServiceClient, output: Output = OutputLog.getInstance()) {
    this.adapterClients = adapterClients;
    this.complianceClient = compliance;
    this.services = [...adapterClients.keys()];
    this.output = output;
  }

  public static async createLocalAdapter<T extends typeof ArtificialAdapter>(this: T, output: Output = OutputLog.getInstance()): Promise<InstanceType<T>> {
    const adapterClients = await getAdapterClients('localhost:5011', new grpc.Metadata(), false);
    return new this(adapterClients, undefined, output) as InstanceType<T>;
  }

  public static async createRemoteAdapter<T extends typeof ArtificialAdapter>(this: T, address: string, prefix: string, org: string, lab: string, token: string, output: Output = OutputLog.getInstance()): Promise<InstanceType<T>> {
    try {
      OutputLog.getInstance().log('Attempting to get remote scope');
      const remoteScope = await getRemoteScope(`labmanager.${address}`, lab, token);
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
    adapterClients = await getAdapterClients(`labmanager.${address}`, md, true);
    return new this(adapterClients, complianceClientConstructor(address, token, true), output) as InstanceType<T>;
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
    // Try the two ways these things seem to get registered.  At least until we fully standardize
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
  adapterServiceClient: AdapterServiceClient;
  labId: string;

  constructor(adapterClients: Map<string, AdapterClient>, adapterServiceClient: AdapterServiceClient, labId: string, compliance?: ComplianceModeServiceClient, output: Output = OutputLog.getInstance()) {
    super(adapterClients, compliance, output);
    this.adapterServiceClient = adapterServiceClient;
    this.labId = labId;
  }

  public static async createAdapterManager<T extends typeof ArtificialAdapterManager>(this: T, address: string, prefix: string, org: string, lab: string, token: string, output: Output = OutputLog.getInstance()): Promise<InstanceType<T>> {
    try {
      OutputLog.getInstance().log('Attempting to get remote scope');
      const remoteScope = await getRemoteScope(`labmanager.${address}`, lab, token);
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
    md.set("forward-to", `${prefix}:${org}:${lab}-manager:substrate`);
    var adapterClients: Map<string, AdapterClient>;
    adapterClients = await getAdapterClients(`labmanager.${address}`, md, true);
    const lmMd = new grpc.Metadata();
    lmMd.set("authorization", `Bearer ${token}`);
    const adapterClient = new AdapterServiceClient(`labmanager.${address}`, grpc.credentials.combineChannelCredentials(grpc.credentials.createSsl(), grpc.credentials.createFromMetadataGenerator(
      (_: any, cb: (err: Error | null, metadata?: grpc.Metadata) => void) => {
        cb(null, lmMd);
      }
    )), {
      callInvocationTransformer: (callProperties) => {
        callProperties.callOptions.deadline = new Date(Date.now() + 15000);
        return callProperties;
      }
    });
    return new ArtificialAdapterManager(adapterClients, adapterClient, lab, complianceClientConstructor(address, token, true), output) as InstanceType<T>;
  }

  public async updateAdapterImage(adapterName: string, image: string): Promise<void> {
    const compliance = await new Promise<boolean>((resolve, reject) => {
      if (!this.complianceClient) {
        resolve(false);
      } else {
        this.complianceClient.getComplianceMode(new GetComplianceModeRequest(), (err: grpc.ServiceError | null, response: GetComplianceModeResponse) => {
          if (err) {
            reject(err);
          }
          if (response.getMode() === ComplianceModeState.COMPLIANCE_MODE_ON_GLOBAL) {
            resolve(true);
          }
          resolve(false);
        });
      }
    });

    if (compliance) {
      // If image is not semver, we should reject
      const tag = image.split(':').pop();
      if (!semver.valid(tag)) {
        throw new Error('Cannot update adapter image to a non CI built image while in compliance mode');
      }
    }

    return new Promise<void>((resolve, reject) => {
      // First try the management client
      this.adapterServiceClient.updateAdapterImage(new UpdateAdapterImageRequest().setAdapterId(adapterName).setImage(image).setLabId(this.labId), (err: grpc.ServiceError | null, _: any) => {
        (err: grpc.ServiceError | null, _: any) => {
          if (err) {
            if (err.code === grpc.status.UNIMPLEMENTED) {
              // Fallback to the adapter manager direct connection
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
            }
          } else {
            resolve();
          }
        };
      });
    });
  }


  public async listNonManagerAdapters(): Promise<AdapterInfo[]> {
    // TODO: Filter out dupes when recently connected
    return new Promise((resolve, reject) => {
      this.adapterServiceClient.listAdapters(new ListAdaptersRequest().setLabId(this.labId), async (err: grpc.ServiceError | null, response: ListAdaptersResponse) => {
        if (err) {
          if (err.code === grpc.status.UNIMPLEMENTED) {
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

          } else {
            reject(err);
          }
        } else {
          try {
          const adapters = await this.getAdapters(response.getAdapterIdsList());
          resolve(Array.from(adapters.values()));
          } catch (e) {
            reject(e);
          }
        }
      }
      );

    });
  }

  async getAdapters(ids: string[]): Promise<Map<string,AdapterInfo>> {
    const adapters = (await Promise.all(ids.map(async (id) => {
      return new Promise<AdapterInfo | void>((resolve, reject) => {
        this.adapterServiceClient.getAdapter(new GetAdapterRequest().setAdapterId(id).setLabId(this.labId), (err: grpc.ServiceError | null, response: GetAdapterResponse) => {
          if (err) {
            this.output.log(`Error getting adapter ${id}: ${err.message}`);
            resolve();
          } else {
            const adapter = response.getAdapter();
            if (adapter) {
              const management = adapter.getManagement();
              if (management) {
                resolve({
                  name: adapter.getId(),
                  image: management.getImage(),
                  is_manager: false, // eslint-disable-line @typescript-eslint/naming-convention
                });
              } else {
                resolve();
              }
            }
          }
        });
      });
    }))).filter((adapter) => adapter !== undefined);

    if (adapters.length === 0) {
      throw new Error('No adapters found. Make sure adapter manager is deployed and up to date');
    }

    const m = new Map();
    adapters.forEach((adapter) => {
      if (adapter) {
        m.set(adapter.name, adapter);
      }
    });
    return m;
  }
}
