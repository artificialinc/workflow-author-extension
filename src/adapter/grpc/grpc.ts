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
import { ServiceClient } from '@grpc/grpc-js/build/src/make-client';
import { GrpcReflection } from 'grpc-js-reflection-client';
import { LabManagerClient } from '@artificial/artificial-protos/grpc-js/artificial/api/labmanager/v1/labmanager_service_grpc_pb';
import { GetConnectionsRequest, GetConnectionsResponse, GetScopeRequest, GetScopeResponse } from '@artificial/artificial-protos/grpc-js/artificial/api/labmanager/v1/labmanager_service_pb';

const HIDDEN_SERVICES = ["grpc.reflection.v1alpha.ServerReflection", "grpc.reflection.v1.ServerReflection", "artificial.adapter_common.InternalActions"];

export type AdapterClient = {
    client: ServiceClient,
    methods: string[]
};

function callOptions(timeoutMs: number): grpc.CallOptions {
    return { deadline: Date.now() + timeoutMs };
}

export function credsConstructor(md: grpc.Metadata, ssl: boolean = true): () => grpc.ChannelCredentials {
    return () => {
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
}

function channelOptions(): grpc.ChannelOptions {
    return {
        'grpc.service_config': JSON.stringify({  // eslint-disable-line @typescript-eslint/naming-convention
            methodConfig: [
                {
                    name: [],
                    retryPolicy: {
                        maxAttempts: 5,
                        initialBackoff: '1s',
                        maxBackoff: '10s',
                        backoffMultiplier: 5,
                        retryableStatusCodes: ["UNAVAILABLE", "PERMISSION_DENIED", "UNKNOWN"],
                    },
                },
            ],
        }),
    };
}

async function extractServiceClientConstructor(client: GrpcReflection, service: string, timeoutMs: number): Promise<[grpc.ServiceClientConstructor, Array<string>]> {
    // Get services without proto file for specific symbol or file name
    const descriptor = await client.getDescriptorBySymbol(service, callOptions(timeoutMs));

    // Create package services
    const packageObject = descriptor.getPackageObject({
        keepCase: true,
        enums: String,
        longs: String,
    });

    // It seems like there should be a better way to do this. But typscript unions were throwing things off

    // Split symbol
    const symbol = service.split('.');
    // Get package
    let protoFunc: grpc.GrpcObject = packageObject;
    for (let i = 0; i < symbol.length; i++) {
        // @ts-ignore
        protoFunc = protoFunc[symbol[i]];
    }

    const localMethods: Array<string> = Object.keys(protoFunc.service).map((value) => {
        // @ts-ignore
        return protoFunc.service[value].originalName;
    });

    // @ts-ignore
    return [protoFunc, localMethods];
}

export class UnimplementedError extends Error {
    constructor(message: string) {
        super(message);
    }
}

export type RemoteScope = {
    namespace: string,
    orgId: string,
    labId: string,
};

export async function getRemoteScope(address: string, lab: string, token: string, ssl: boolean = true, timeoutMs: number = 5000): Promise<RemoteScope> {
    // Connect with grpc server reflection
    const md = new grpc.Metadata();
    md.set("authorization", `Bearer ${token}`);
    const creds = credsConstructor(md, ssl);
    const client = new LabManagerClient(address, creds(), channelOptions());
    return new Promise((resolve, reject) => {
        client.getScope(
            new GetScopeRequest().setLabId(lab), // eslint-disable-line @typescript-eslint/naming-convention
            (err: grpc.ServiceError | null, response: GetScopeResponse) => {
            if (err) {
                reject(err);
            } else {
                resolve({
                    namespace: response.getNamespace(),
                    orgId: response.getOrgId(),
                    labId: response.getLabId(),
                });
            }
        });
    });
}

/**
 * Get adapter client
 * @param address address of adapter. Either localhost for a local address or a remote labmanager address
 * @param md metadata to pass to the adapter. Only used for remote adapters. Auth and forward-to are needed
 * @param ssl whether to use ssl or not
 */
export async function getAdapterClients(address: string, md: grpc.Metadata, ssl: boolean = true, timeoutMs: number = 5000): Promise<Map<string, AdapterClient>> {
    // Connect with grpc server reflection
    const creds = credsConstructor(md, ssl);
    const client = new GrpcReflection(address, creds(), channelOptions());
    const services = await client.listServices(undefined, callOptions(timeoutMs));
    // Remove hidden services
    const filteredServices = services.filter((value) => {
        return !HIDDEN_SERVICES.includes(value);
    });

    // Create clients
    const clients = new Map<string, AdapterClient>();

    for (const service of filteredServices) {
        const [clientConstructor, localMethods] = await extractServiceClientConstructor(client, service, timeoutMs);

        // Add to clients
        const grpcClient = new clientConstructor(
            address,
            creds(),
            channelOptions(),
        );

        clients.set(service, { client: grpcClient, methods: localMethods });
    }

    return clients;
}

// TODO: Consider installing the labmanager proto package instead of using reflection.
// export type GetConnectionsRequest = {
//     scope: string
// };

// export type GetConnectionsResponse = {
//     connections: Array<{
//         client: {
//             name: string
//         }
//     }>
// };

export interface LabmanagerClient {
    getConnections(request: GetConnectionsRequest, callback: (error: grpc.ServiceError | null, response: GetConnectionsResponse) => void): void;
    getConnections(request: GetConnectionsRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: GetConnectionsResponse) => void): void;
    getConnections(request: GetConnectionsRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: GetConnectionsResponse) => void): void;
}

export async function getLabmanagerClient(address: string, md: grpc.Metadata, ssl: boolean = true, timeoutMs: number = 5000): Promise<LabmanagerClient> {
    // Connect with grpc server reflection
    const creds = credsConstructor(md, ssl);

    return new LabManagerClient(address, creds(), channelOptions());
}
