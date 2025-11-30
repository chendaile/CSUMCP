import { type RequestInfo, type RequestInit, type Response } from "node-fetch";
import { CookieJar } from "tough-cookie";
type SessionFetch = (input: RequestInfo, init?: RequestInit) => Promise<Response>;
export declare const login: (username: string, password: string) => Promise<{
    sessionFetch: SessionFetch;
    jar: CookieJar;
}>;
export declare const authenticatedRequest: (username: string, password: string, method: string, url: string, body: URLSearchParams | undefined) => Promise<Response>;
export {};
