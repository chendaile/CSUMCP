import { type RequestInfo, type RequestInit, type Response } from "node-fetch";
import { CookieJar } from "tough-cookie";
export type SessionFetch = (input: RequestInfo, init?: RequestInit) => Promise<Response>;
export declare const createSessionFetch: () => {
    sessionFetch: SessionFetch;
    jar: CookieJar;
};
export declare const randomString: (length: number) => string;
export declare const pkcs7Pad: (buffer: Buffer, blockSize?: number) => Buffer<ArrayBuffer>;
export declare const encryptPassword: (password: string, salt: string) => string;
export declare const login: (username: string, password: string) => Promise<{
    sessionFetch: SessionFetch;
    jar: CookieJar;
}>;
export declare const authenticatedRequest: (username: string, password: string, method: string, url: string, body: URLSearchParams | undefined) => Promise<Response>;
