import { Server } from "@modelcontextprotocol/sdk/server/index.js";
export interface CreateServerOptions {
    apiBaseUrl: string;
    docBaseUrl: string;
}
export declare const createMcpServer: (opts?: Partial<CreateServerOptions>) => Server;
