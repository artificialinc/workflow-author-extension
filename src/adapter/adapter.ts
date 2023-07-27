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
    this.services = [ ...adapterClients.keys() ];
    this.remote = remote;
  }

  public static async createLocalAdapter<T extends typeof ArtificialAdapter>(this: T): Promise<InstanceType<T>> {
    const adapterClients = await getAdapterClients('localhost:5011', new grpc.Metadata(), false, false);
    return new this(adapterClients, false) as InstanceType<T>;
  }

  // Lab is tbd. Might be its own "manager lab" or something similar
  public static async createRemoteAdapter<T extends typeof ArtificialAdapter>(address: string, prefix: string, org: string, lab: string, token: string): Promise<InstanceType<T>> {
    const md = new grpc.Metadata();
    md.set("authorization", `Bearer ${token}`);
    md.set("forward-to", `${prefix}:${org}:${lab}:substrate`);
    const adapterClients = await getAdapterClients(address, md, true, true);
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
}

export function setupAdapterCommands(configVals: ConfigValues, context: vscode.ExtensionContext) {
  // Update adapter image command
  context.subscriptions.push(
    vscode.commands.registerCommand('adapterActions.updateAdapterImage', async () => {
      const adapter = await ArtificialAdapterManager.createLocalAdapter();
      // const searchQuery = await vscode.window.showQuickPick(["ghcr.io/artificialinc/adapter-manager:aidan-5","ghcr.io/artificialinc/adapter-manager:aidan-6"]);
      const image = await vscode.window.showQuickPick(new Promise<string[]>((resolve, reject) => {
        resolve([
          "ghcr.io/artificialinc/adapter-manager:aidan-5",
          "ghcr.io/artificialinc/adapter-manager:aidan-6",
          "ghcr.io/artificialinc/adapter-manager:shawn-7",]);
        // resolve(adapter.listActions());
      }), { placeHolder: 'Select an adapter image to update to' });
      if (image === '') {
        console.log(image);
        vscode.window.showErrorMessage('A search query is mandatory to execute this action');
      }

      if (image !== undefined) {
        console.log(image);
        await adapter.updateAdapterImage("adapter_manager", image);
      }
    }
    )
  );

  // Execute adapter action command
  context.subscriptions.push(
    vscode.commands.registerCommand('adapterActions.executeAdapterAction', async () => {
      // const searchQuery = await vscode.window.showQuickPick(["ghcr.io/artificialinc/adapter-manager:aidan-5","ghcr.io/artificialinc/adapter-manager:aidan-6"]);
      const searchQuery = await vscode.window.showQuickPick(new Promise<string[]>(async (resolve, reject) => {
        // resolve(["ghcr.io/artificialinc/adapter-manager:aidan-5","ghcr.io/artificialinc/adapter-manager:aidan-6"]);
        try {
          const adapter2 = await ArtificialAdapter.createRemoteAdapter(
            `labmanager.${configVals.getHost()}`,
            configVals.getPrefix(),
            configVals.getOrgId(),
            configVals.getLabId(),
            configVals.getToken(),
          );
          resolve(adapter2.listActions());
        } catch (e) {
          reject(e);
        }
      }), { placeHolder: "Select an action to execute" });
      if (searchQuery === '') {
        console.log(searchQuery);
        vscode.window.showErrorMessage('A search query is mandatory to execute this action');
      }

      if (searchQuery !== undefined) {
        console.log(searchQuery);
      }
    }
    )
  );
}
