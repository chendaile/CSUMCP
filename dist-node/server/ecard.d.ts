import { type SessionFetch } from "./auth.js";
export declare const loginEcard: (username: string, password: string) => Promise<{
    sessionFetch: SessionFetch;
    finalUrl: string;
    token: string;
}>;
export declare const fetchCardInfo: (username: string, password: string) => Promise<{
    status: number;
    body: string;
    parsed?: any;
    simplified?: any;
    finalUrl?: string;
}>;
export interface EcardTurnoverQuery {
    timeFrom: string;
    timeTo: string;
    amountFrom?: number;
    amountTo?: number;
    size?: number;
    current?: number;
}
export declare const fetchCardTurnover: (username: string, password: string, params: EcardTurnoverQuery) => Promise<{
    status: number;
    body: string;
    parsed?: any;
    simplified?: any;
    finalUrl?: string;
}>;
