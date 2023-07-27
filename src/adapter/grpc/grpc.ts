import * as grpc from '@grpc/grpc-js';
import { ServiceClient } from '@grpc/grpc-js/build/src/make-client';
import { GrpcReflection } from 'grpc-js-reflection-client';

const HIDDEN_SERVICES = ["grpc.reflection.v1alpha.ServerReflection", "grpc.reflection.v1.ServerReflection", "artificial.adapter_common.InternalActions"];

export type AdapterClient = {
    client: ServiceClient,
    methods: string[]
};

/**
 * Get adapter client
 * @param address address of adapter. Either localhost for a local address or a remote labmanager address
 * @param md metadata to pass to the adapter. Only used for remote adapters. Auth and forward-to are needed
 * @param ssl whether to use ssl or not
 * @param remote whether to use remote or local symbol. This might go away if the symbols can be the same
 */
export async function getAdapterClients(address: string, md: grpc.Metadata, ssl: boolean = true, remote: boolean = true): Promise<Map<string, AdapterClient>> {
    // Create metadata constructor
    const credsConstructor = () => {
        if (ssl) {
            return grpc.credentials.combineChannelCredentials(
                grpc.credentials.createSsl(),
                grpc.credentials.createFromMetadataGenerator((_, callback) => {
                    callback(null, md);
                }),
            );
        } else {
            return grpc.credentials.createInsecure();
        }
    };
    // Connect with grpc server reflection
    const client = new GrpcReflection(address, credsConstructor());

    const services = await client.listServices();

    // Remove hidden services
    const filteredServices = services.filter((value) => {
        return !HIDDEN_SERVICES.includes(value);
    });

    // Create clients
    const clients = new Map<string, AdapterClient>();

    for (const service of filteredServices) {

        // Get services without proto file for specific symbol or file name
        const descriptor = await client.getDescriptorBySymbol(service);

        // Create package services
        const packageObject = descriptor.getPackageObject({
            keepCase: true,
            enums: String,
            longs: String,
        });

        // Split symbol
        const symbol = service.split('.');
        // Get package
        let protoFunc = packageObject;
        for (let i = 0; i < symbol.length; i++) {
            // @ts-ignore
            protoFunc = protoFunc[symbol[i]];
        }

        const localMethods: any = Object.keys(protoFunc.service).map((value) => {
            // @ts-ignore
            return protoFunc.service[value].originalName;
        });

        // Add to clients
        // @ts-ignore
        const proto = new protoFunc(
            address,
            credsConstructor(),
        );
        clients.set(service, { client: proto, methods: localMethods });
    }

    return clients;
}
