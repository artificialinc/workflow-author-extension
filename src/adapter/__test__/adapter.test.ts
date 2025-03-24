/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-ts-comment */
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
import * as grpc from '@grpc/grpc-js';
import { ArtificialAdapterManager } from '../adapter';
import { mock } from 'jest-mock-extended';
import { expect, jest, test } from '@jest/globals';
import { AdapterClient } from '../grpc/grpc';
import { ComplianceModeServiceClient } from '@artificial/artificial-protos/grpc-js/artificial/api/alab/compliance/v1/mode_grpc_pb';
import {
  ComplianceModeState,
  GetComplianceModeRequest,
  GetComplianceModeResponse,
} from '@artificial/artificial-protos/grpc-js/artificial/api/alab/compliance/v1/mode_pb';
import { AdapterServiceClient } from '@artificial/artificial-protos/grpc-js/artificial/api/alab/adapter/v1/adapter_grpc_pb';
import {
  Adapter,
  Address,
  GetAdapterRequest,
  GetAdapterResponse,
  ListAdaptersRequest,
  ListAdaptersResponse,
  ManagedAdapter,
  UpdateAdapterImageRequest,
  UpdateAdapterImageResponse,
} from '@artificial/artificial-protos/grpc-js/artificial/api/alab/adapter/v1/adapter_pb';
import { callErrorFromStatus } from '@grpc/grpc-js/build/src/call';
import { InternalActionsClient } from '@artificial/artificial-protos/grpc-js/artificial/api/adapter/internal_actions/v1/internal_actions_grpc_pb';

describe('test artificial adapter', function () {
  afterEach(function () {
    jest.clearAllMocks();
  });

  test('test update adapter image with manager', async function () {
    const m = mock<AdapterServiceClient>();
    m.updateAdapterImage = jest.fn().mockImplementation(
      // @ts-ignore
      (
        _request: UpdateAdapterImageRequest,
        cb: (err: grpc.ServiceError | null, response: UpdateAdapterImageResponse) => void,
      ) => {
        cb(null, new UpdateAdapterImageResponse());
      },
    ) as any;
    const c = mock<ComplianceModeServiceClient>();
    c.getComplianceMode = jest.fn().mockImplementation(
      // @ts-ignore
      (
        _request: GetComplianceModeRequest,
        cb: (err: grpc.ServiceError | null, response: GetComplianceModeResponse) => void,
      ) => {
        cb(null, new GetComplianceModeResponse().setMode(ComplianceModeState.COMPLIANCE_MODE_OFF));
      },
    ) as any;

    const adapter = new ArtificialAdapterManager(new Map([]), mock<InternalActionsClient>(), m, 'labId', c);

    await adapter.updateAdapterImage('adapter_manager', 'ghcr.io/artificialinc/adapter-manager:aidan-5', 'labId');
    expect(m.updateAdapterImage).toBeCalledWith(
      new UpdateAdapterImageRequest()
        .setLabId('labId')
        .setAdapterId('adapter_manager')
        .setImage('ghcr.io/artificialinc/adapter-manager:aidan-5'),
      expect.any(Function),
    );
  });

  test('test update adapter image with manager fallback', async function () {
    const m = mock<AdapterServiceClient>();
    m.updateAdapterImage = jest.fn().mockImplementation(
      // @ts-ignore
      (
        _request: UpdateAdapterImageRequest,
        cb: (err: grpc.ServiceError | null, response: UpdateAdapterImageResponse) => void,
      ) => {
        cb(
          callErrorFromStatus(
            new grpc.StatusBuilder().withCode(grpc.status.UNIMPLEMENTED).build() as grpc.StatusObject,
            '',
          ),
          new UpdateAdapterImageResponse(),
        );
      },
    ) as any;
    const c = mock<ComplianceModeServiceClient>();
    c.getComplianceMode = jest.fn().mockImplementation(
      // @ts-ignore
      (
        _request: GetComplianceModeRequest,
        cb: (err: grpc.ServiceError | null, response: GetComplianceModeResponse) => void,
      ) => {
        cb(null, new GetComplianceModeResponse().setMode(ComplianceModeState.COMPLIANCE_MODE_OFF));
      },
    ) as any;

    const mac = mock<AdapterClient>();
    mac.client.updateAdapterImage = jest.fn((_, cb: (err: Error | null, data: any) => void) => cb(null, {}));
    const adapter = new ArtificialAdapterManager(
      new Map([['manager.management_actions.ManagementActions', mac]]),
      mock<InternalActionsClient>(),
      m,
      'labId',
      c,
    );

    await adapter.updateAdapterImage('adapter_manager', 'ghcr.io/artificialinc/adapter-manager:aidan-5', 'labId');
    expect(mac.client.updateAdapterImage).toBeCalledWith(
      {
        adapter_name: { value: 'adapter_manager' }, // eslint-disable-line @typescript-eslint/naming-convention
        image: { value: 'ghcr.io/artificialinc/adapter-manager:aidan-5' },
      },
      expect.any(Function),
    );
  });

  test('test update adapter image compliance with manager', async function () {
    const m = mock<AdapterClient>();
    m.client.updateAdapterImage = jest.fn((_, cb: (err: Error | null, data: any) => void) => cb(null, {}));
    const c = mock<ComplianceModeServiceClient>();
    c.getComplianceMode = jest.fn().mockImplementation(
      // @ts-ignore
      (
        _request: GetComplianceModeRequest,
        cb: (err: grpc.ServiceError | null, response: GetComplianceModeResponse) => void,
      ) => {
        cb(null, new GetComplianceModeResponse().setMode(ComplianceModeState.COMPLIANCE_MODE_ON_GLOBAL));
      },
    ) as any;

    const adapter = new ArtificialAdapterManager(
      new Map([['manager.management_actions.ManagementActions', m]]),
      mock<InternalActionsClient>(),
      mock<AdapterServiceClient>(),
      'labId',
      c,
    );
    await expect(
      adapter.updateAdapterImage('adapter_manager', 'ghcr.io/artificialinc/adapter-manager:aidan-5', 'labId'),
    ).rejects.toThrowError('Cannot update adapter image to a non CI built image while in compliance mode');
  });

  test('test udpate adapter image compliance good version with manager', async function () {
    const m = mock<AdapterServiceClient>();
    m.updateAdapterImage = jest.fn().mockImplementation(
      // @ts-ignore
      (
        _request: UpdateAdapterImageRequest,
        cb: (err: grpc.ServiceError | null, response: UpdateAdapterImageResponse) => void,
      ) => {
        cb(null, new UpdateAdapterImageResponse());
      },
    ) as any;
    const c = mock<ComplianceModeServiceClient>();
    c.getComplianceMode = jest.fn().mockImplementation(
      // @ts-ignore
      (
        _request: GetComplianceModeRequest,
        cb: (err: grpc.ServiceError | null, response: GetComplianceModeResponse) => void,
      ) => {
        cb(null, new GetComplianceModeResponse().setMode(ComplianceModeState.COMPLIANCE_MODE_ON_GLOBAL));
      },
    ) as any;

    const adapter = new ArtificialAdapterManager(new Map([]), mock<InternalActionsClient>(), m, 'labId', c);

    await adapter.updateAdapterImage('adapter_manager', 'ghcr.io/artificialinc/adapter-manager:1.2.3', 'labId');
    expect(m.updateAdapterImage).toBeCalledWith(
      new UpdateAdapterImageRequest()
        .setLabId('labId')
        .setAdapterId('adapter_manager')
        .setImage('ghcr.io/artificialinc/adapter-manager:1.2.3'),
      expect.any(Function),
    );
  });

  test('test list adapters with manager', async function () {
    const m = mock<AdapterServiceClient>();
    m.listAdapters = jest.fn().mockImplementation(
      // @ts-ignore
      (_request: ListAdaptersRequest, cb: (err: grpc.ServiceError | null, response: ListAdaptersResponse) => void) => {
        cb(null, new ListAdaptersResponse().setAdapterIdsList(['adapter1']));
      },
    ) as any;
    m.getAdapter = jest.fn().mockImplementation(
      // @ts-ignore
      (request: GetAdapterRequest, cb: (err: grpc.ServiceError | null, response: GetAdapterResponse) => void) => {
        switch (request.getAdapterId()) {
          case 'adapter1':
            cb(
              null,
              new GetAdapterResponse().setAdapter(
                new Adapter()
                  .setScope('scope')
                  .setAddress(new Address().setLabId('labId'))
                  .setId('adapter1')
                  .setActiveSubscription(true)
                  .setManagement(new ManagedAdapter().setImage('ghcr.io/artificialinc/adapter1:aidan-5')),
              ),
            );
            break;
        }
      },
    ) as any;

    const adapter = new ArtificialAdapterManager(
      new Map([]),
      mock<InternalActionsClient>(),
      m,
      'labId',
      mock<ComplianceModeServiceClient>(),
    );
    const adapters = await adapter.listNonManagerAdapters(false);

    expect(adapters).toStrictEqual([
      {
        banned: false,
        name: 'adapter1',
        image: 'ghcr.io/artificialinc/adapter1:aidan-5',
        // eslint-disable-next-line @typescript-eslint/naming-convention
        is_manager: false,
        labId: 'labId',
        scope: 'scope',
      },
    ]);
    expect(m.listAdapters).toBeCalledWith(new ListAdaptersRequest().setLabId('labId'), expect.any(Function));

    const mac = mock<AdapterClient>();
    mac.client.listAdapters = jest.fn((_, cb: (err: Error | null, data: any) => void) =>
      cb(null, {
        value: [
          {
            name: 'adapter1',
            image: 'ghcr.io/artificialinc/adapter1:aidan-5',
            is_manager: false, // eslint-disable-line @typescript-eslint/naming-convention
          },
          {
            name: 'adapter_manager',
            image: 'ghcr.io/artificialinc/adapter-manager:aidan-5',
            is_manager: true, // eslint-disable-line @typescript-eslint/naming-convention
          },
        ],
      }),
    );
    m.listAdapters = jest.fn().mockImplementation(
      // @ts-ignore
      (_request: ListAdaptersRequest, cb: (err: grpc.ServiceError | null, response: ListAdaptersResponse) => void) => {
        cb(
          callErrorFromStatus(
            new grpc.StatusBuilder().withCode(grpc.status.UNIMPLEMENTED).build() as grpc.StatusObject,
            '',
          ),
          new ListAdaptersResponse(),
        );
      },
    ) as any;

    const adapter2 = new ArtificialAdapterManager(
      new Map([['manager.management_actions.ManagementActions', mac]]),
      mock<InternalActionsClient>(),
      m,
      'labId',
      mock<ComplianceModeServiceClient>(),
    );
    const adapters2 = await adapter2.listNonManagerAdapters(false);

    expect(adapters2).toStrictEqual([
      // eslint-disable-next-line @typescript-eslint/naming-convention
      { name: 'adapter1', image: 'ghcr.io/artificialinc/adapter1:aidan-5', is_manager: false },
    ]);
    expect(m.listAdapters).toBeCalledWith(new ListAdaptersRequest().setLabId('labId'), expect.any(Function));
  });
});
