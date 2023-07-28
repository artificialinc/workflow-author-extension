import * as grpc from '@grpc/grpc-js';
import wrapServerWithReflection from 'grpc-node-server-reflection';
import * as protoLoader from '@grpc/proto-loader';

// Start a server with reflection
export const startServer = async (port: number): Promise<grpc.Server> => {
  const defOptions = {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
  };

  const testPkg = grpc.loadPackageDefinition(
    protoLoader.loadSync(
      __dirname + '../../../../../protos/test.proto',
      defOptions
    ));


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
