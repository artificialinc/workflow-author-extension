import { ArtificialAdapterManager } from '../adapter';
import { mock } from 'jest-mock-extended';
import { expect, jest, test } from '@jest/globals';
import { AdapterClient } from '../grpc/grpc';

describe('test artificial adapter', function () {
  test('test udpate adapter image with manager', async function () {
    const m = mock<AdapterClient>();
    m.client.updateAdapterImage = jest.fn((_ , cb: (err: Error | null, data: any)=> void) => cb(null, {}));
    const adapter = new ArtificialAdapterManager(new Map([["manager.management_actions.ManagementActions", m]]), false);
    await adapter.updateAdapterImage("adapter_manager", "ghcr.io/artificialinc/adapter-manager:aidan-5");

    expect(m.client.updateAdapterImage).toBeCalledWith({
      "adapter_name": { value: "adapter_manager" }, // eslint-disable-line @typescript-eslint/naming-convention
      "image": { value: "ghcr.io/artificialinc/adapter-manager:aidan-5" },
    }, expect.any(Function));
  });
});
