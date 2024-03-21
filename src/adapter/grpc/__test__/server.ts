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
import wrapServerWithReflection from 'grpc-node-server-reflection';
import * as protoLoader from '@grpc/proto-loader';

  const defOptions = {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
  };

export const testPkg = grpc.loadPackageDefinition(
    protoLoader.loadSync(
      __dirname + '../../../../../proto/test.proto',
      defOptions
    ));

export const labmanagerPkg = grpc.loadPackageDefinition(
    protoLoader.loadSync(
      __dirname + '../../../../../proto/labmanager.proto',
      defOptions
    ));

export const labmanagerNoScopePkg = grpc.loadPackageDefinition(
    protoLoader.loadSync(
      __dirname + '../../../../../proto/labmanager_no_get_scope.proto',
      defOptions
    ));

// Start a server with reflection
export const startServer = async (port: number): Promise<grpc.Server> => {
  // This wraps the instance of gRPC server with the Server Reflection service and returns it.
  const server = wrapServerWithReflection(new grpc.Server());

  server.addService(
    //@ts-ignore
    testPkg.manager.management_actions.ManagementActions.service, {
    TestCall: (_: any, callback: any) => { // eslint-disable-line @typescript-eslint/naming-convention
      callback(null, {
        success: true,
        id: "123"
      });
    }
  }
  );

  // Choose a random port
  // TODO: Don't return until server has started
  server.bindAsync(`127.0.0.1:${port}`, grpc.ServerCredentials.createInsecure(), (err: any) => {
    if (err) {
      throw err;
    }
    server.start();
    console.log(`Server started on port ${port}`);
  });

  return server;
};
