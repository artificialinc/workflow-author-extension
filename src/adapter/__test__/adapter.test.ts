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
import * as vscode from 'vscode';
import { ArtificialAdapterManager, Output } from '../adapter';
import { mock } from 'jest-mock-extended';
import { expect, jest, test } from '@jest/globals';
import { AdapterClient } from '../grpc/grpc';
import { after } from 'lodash';

describe('test artificial adapter', function () {
  afterEach(function () {
    jest.clearAllMocks();
  });

  test('test udpate adapter image with manager', async function () {
    const m = mock<AdapterClient>();
    m.client.updateAdapterImage = jest.fn((_, cb: (err: Error | null, data: any) => void) => cb(null, {}));
    const adapter = new ArtificialAdapterManager(new Map([["manager.management_actions.ManagementActions", m]]));
    await adapter.updateAdapterImage("adapter_manager", "ghcr.io/artificialinc/adapter-manager:aidan-5");

    expect(m.client.updateAdapterImage).toBeCalledWith({
      "adapter_name": { value: "adapter_manager" }, // eslint-disable-line @typescript-eslint/naming-convention
      "image": { value: "ghcr.io/artificialinc/adapter-manager:aidan-5" },
    }, expect.any(Function));
  });

  test('test list adapters with manager', async function () {
    const m = mock<AdapterClient>();
    m.client.listAdapters = jest.fn((_, cb: (err: Error | null, data: any) => void) => cb(null, {
      "value": [
        {
          "name": "adapter1",
          "image": "ghcr.io/artificialinc/adapter1:aidan-5",
          "is_manager": false, // eslint-disable-line @typescript-eslint/naming-convention
        },
        {
          "name": "adapter_manager",
          "image": "ghcr.io/artificialinc/adapter-manager:aidan-5",
          "is_manager": true,   // eslint-disable-line @typescript-eslint/naming-convention
        },
      ]
    }));
    const adapter = new ArtificialAdapterManager(new Map([["manager.management_actions.ManagementActions", m]]));
    const adapters = await adapter.listNonManagerAdapters();

    expect(adapters).toStrictEqual([{ name: "adapter1", image: "ghcr.io/artificialinc/adapter1:aidan-5", is_manager: false }]); // eslint-disable-line @typescript-eslint/naming-convention
    expect(m.client.listAdapters).toBeCalledWith({}, expect.any(Function));

    const adapter2 = new ArtificialAdapterManager(new Map([["adapter.manager.management_actions.ManagementActions", m]]));
    const adapters2 = await adapter2.listNonManagerAdapters();

    expect(adapters2).toStrictEqual([{ name: "adapter1", image: "ghcr.io/artificialinc/adapter1:aidan-5", is_manager: false }]); // eslint-disable-line @typescript-eslint/naming-convention
    expect(m.client.listAdapters).toBeCalledWith({}, expect.any(Function));
  });

  test('test list adapters with missing manager', async function () {
    const mockLog = mock<Output>();

    const adapter = new ArtificialAdapterManager(new Map([["fake", mock<AdapterClient>()]]), mockLog);
    await expect(adapter.listNonManagerAdapters()).rejects.toThrowError("Could not find adapter manager client");

    expect(mockLog.log).toBeCalledWith("Could not find management client, available clients are: fake");
  });
});
