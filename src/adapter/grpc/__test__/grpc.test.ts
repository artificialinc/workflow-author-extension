import { getAdapterClients } from '../grpc';
import * as grpc from '@grpc/grpc-js';
import { StringValue } from 'google-protobuf/google/protobuf/wrappers_pb';
import { expect, jest, test, describe, beforeEach } from '@jest/globals';
import { startServer } from './server';
import waitForExpect from 'wait-for-expect';

describe('test grpc against local server', function () {
  let server: grpc.Server | undefined;
  let port: number;

  beforeEach(async function () {
    // pick random port
    port = Math.floor(Math.random() * (55000 - 50000) + 50000);
    server = await startServer(port);
  });

  afterEach(async function () {
    if (server) {
      server.forceShutdown();
    }
  });

  test('test grpc ok', async function () {
    const adapter = await getAdapterClients(`127.0.0.1:${port}`, new grpc.Metadata(), false, false);

    const e = jest.fn();

    adapter.get('manager.management_actions.ManagementActions')?.client.testCall({
      "adapter_name": { value: "adapter_manager" }, // eslint-disable-line @typescript-eslint/naming-convention
      "image": { value: "ghcr.io/artificialinc/adapter-manager:aidan-5" },
    }, (err: Error, _: any) => {
      expect(err).toBeNull();
      e();
    });

    await waitForExpect(() => {
      expect(e).toHaveBeenCalled();
    });

  }, 10000);
});

describe('test grpc against real adapters', function () {
  test('test grpc.getAdapterClient remote', async function () {
    // Skip in CI
    if (process.env.CI) {
      console.log("Skipping test");
      return;
    }
    let md = new grpc.Metadata();
    md.set("authorization", `Bearer ${process.env.ART_TOKEN}`);
    md.set("forward-to", "sprint-rc:artificial:adapter-manager-not-a-real-lab-2:substrate");
    const adapter = await getAdapterClients('labmanager.sprint-rc.notartificial.xyz:443', md, true, true);
    const e = jest.fn();

    adapter.get('adapter.manager.management_actions.ManagementActions')?.client.updateAdapterImage({
      // "adapter_name": text.toObject(),
      "adapter_name": { value: "adapter_manager" }, // eslint-disable-line @typescript-eslint/naming-convention
      "image": { value: "ghcr.io/artificialinc/adapter-manager:aidan-5" },
    }, (err: Error, data: any) => {
      expect(err).toBeNull();
      e();
    });

    await waitForExpect(() => {
      expect(e).toHaveBeenCalled();
    });
  }, 10000);

  test('test grpc.getAdapterClient local', async function () {
    // Skip in CI
    if (process.env.CI) {
      console.log("Skipping test");
      return;
    }
    let md = new grpc.Metadata();

    const adapter = await getAdapterClients('127.0.0.1:5011', md, false, false);

    const e = jest.fn();

    adapter.get('manager.management_actions.ManagementActions')?.client.updateAdapterImage({
      // "adapter_name": text.toObject(),
      "adapter_name": { value: "adapter_manager" }, // eslint-disable-line @typescript-eslint/naming-convention
      "image": { value: "ghcr.io/artificialinc/adapter-manager:aidan-5" },
    }, (err: Error, data: any) => {
      expect(err).toBeNull();
      e();
    });

    await waitForExpect(() => {
      expect(e).toHaveBeenCalled();
    });
  }, 10000);
});
