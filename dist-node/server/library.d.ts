import type { JwcUser } from "./jwc.js";
import { type SessionFetch } from "./auth.js";
export interface LibraryBookItem {
    RecordId: number;
    Title: string;
    Author: string;
    Publisher: string;
    ISBNs: string[];
    PublishYear: string;
    CallNo: string[];
    DocName: string;
    PhysicalCount: number;
    OnShelfCount: number;
    Language: string;
    Country: string;
    Subjects: string;
    Abstract: string;
    Picture: string;
    url: string;
}
export interface LibraryBookSearchResult {
    Total: number;
    Items: LibraryBookItem[];
    url?: string;
}
export interface LibraryBookItemCopy {
    ItemId: number;
    CallNo: string;
    Barcode: string;
    LibCode: string;
    LibName: string;
    LocationId: number;
    LocationName: string;
    CurLocationId: number;
    CurLocationName: string;
    Vol: string;
    InDate: string;
    ProcessType: string;
    ItemPolicyName: string;
    ShelfNo: string;
}
export interface LibraryBookItemCopiesResult {
    Total: number;
    Items: LibraryBookItemCopy[];
    url?: string;
}
export interface LibrarySeatCampus {
    Name: string;
    Remaining: number;
    Total: number;
    SeatUrl: string;
    Floors: LibrarySeatFloor[];
}
export interface LibrarySeatFloor {
    Id: number;
    Name: string;
    Total: number;
    Unavailable: number;
    Remaining: number;
    SeatUrl: string;
}
export interface LibrarySeatCampusResult {
    Campuses: LibrarySeatCampus[];
}
export declare const loginLibrary: (username: string, password: string) => Promise<{
    sessionFetch: SessionFetch;
    jar: import("tough-cookie").CookieJar;
}>;
export declare const loginLibraryOpac: (username: string, password: string) => Promise<{
    sessionFetch: SessionFetch;
    jar: import("tough-cookie").CookieJar;
}>;
export declare const authenticatedLibraryRequest: (username: string, password: string, method: string, url: string, body: URLSearchParams | undefined) => Promise<import("node-fetch").Response>;
export declare const searchLibraryBooks: (_user: JwcUser, kw: string) => Promise<{
    status: number;
    body: string;
    parsed: LibraryBookSearchResult;
    url: string;
}>;
export declare const fetchBookCopies: (_user: JwcUser, recordId: string) => Promise<{
    status: number;
    body: string;
    parsed: LibraryBookItemCopiesResult;
    url: string;
}>;
export declare const fetchSeatCampuses: () => Promise<{
    status: number;
    body: string;
    parsed?: LibrarySeatCampusResult;
}>;
export interface LibraryDbEntry {
    Index: string;
    Name: string;
    DetailUrl: string;
    AccessId: string;
}
export interface LibraryDbSearchResult {
    Chinese: LibraryDbEntry[];
    Foreign: LibraryDbEntry[];
}
export declare const searchLibraryDb: (elecName: string) => Promise<LibraryDbSearchResult>;
