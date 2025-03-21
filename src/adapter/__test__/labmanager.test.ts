/* eslint-disable @typescript-eslint/no-explicit-any */
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
import { Labmanager } from '../labmanager';
import { mock } from 'jest-mock-extended';
import { expect, test } from '@jest/globals';
import { LabmanagerClient } from '../grpc/grpc';
import * as grpc from '@grpc/grpc-js';
import {
  GetConnectionsRequest,
  GetConnectionsResponse,
} from '@artificial/artificial-protos/grpc-js/artificial/api/labmanager/v1/labmanager_service_pb';

jest.mock('../grpc/grpc');

describe('test labmanager', function () {
  test('test udpate adapter image with manager', async function () {
    const m = mock<LabmanagerClient>();
    (m.getConnections as unknown as any).mockImplementation(
      (_: any, cb: (err: grpc.ServiceError | null, data: any) => void) => {
        cb(null, new GetConnectionsResponse().setConnectionsList([]));
      },
    );
    const lm = new Labmanager(m, 'prefix', 'org', 'lab');
    await lm.getAdapters();

    expect(m.getConnections).toBeCalledWith(
      new GetConnectionsRequest().setScope('prefix:org:lab:'),
      expect.any(Function),
    );
  }, 10000);
});
