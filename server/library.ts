import crypto from "crypto";
import fetch, {
        type RequestInfo,
        type RequestInit,
        type Response,
} from "node-fetch";
import fetchCookie from "fetch-cookie";
import { CookieJar } from "tough-cookie";
import { load as loadHTML, type Cheerio } from "cheerio";
import type { AnyNode } from "domhandler";
import { logger } from "../logger.js";
import type { JwcUser } from "./jwc.js";

type SessionFetch = (
        input: RequestInfo,
        init?: RequestInit
) => Promise<Response>;

const LIB_SERVICE_URL =
        "https://lib.csu.edu.cn/system/resource/code/auth/clogin.jsp";
const OPAC_SERVICE_URL =
        "https://opac.lib.csu.edu.cn/csu_sso/login_auth/cas/csu/index";
const casLoginURL = `https://ca.csu.edu.cn/authserver/login?service=${encodeURIComponent(
        LIB_SERVICE_URL
)}`;
const opacCasLoginURL = `https://ca.csu.edu.cn/authserver/login?service=${encodeURIComponent(
        OPAC_SERVICE_URL
)}`;
const aesCharSet = "ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678";
const LIB_DB_SEARCH_URL = "https://libdb.csu.edu.cn/accessData";
const OPAC_UNIFY_SEARCH_URL =
        "https://opac.lib.csu.edu.cn/find/unify/search";
const OPAC_GROUP_ITEMS_URL =
        "https://opac.lib.csu.edu.cn/find/physical/groupitems";
const LIB_SEAT_HOME_URL = "https://libzw.csu.edu.cn/home/web/f_second";
const LIB_SEAT_AREA_API_PREFIX = "https://libzw.csu.edu.cn/api.php/v3areas/";
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
}

export interface LibraryBookSearchResult {
        Total: number;
        Items: LibraryBookItem[];
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
}

export interface LibrarySeatCampus {
        Name: string;
        Remaining: number;
        Total: number;
        SeatApi: string;
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

const debug = (...args: unknown[]) => {
        logger.info("[library]", ...args);
};

const createSessionFetch = (): {
        sessionFetch: SessionFetch;
        jar: CookieJar;
} => {
        const jar = new CookieJar();
        const sessionFetch = fetchCookie(
                fetch as unknown as SessionFetch,
                jar
        ) as SessionFetch;
        debug("session created with empty cookie jar");
        return { sessionFetch, jar };
};

const randomString = (length: number) => {
        if (length <= 0) return "";
        let out = "";
        for (let i = 0; i < length; i += 1) {
                const idx = crypto.randomInt(0, aesCharSet.length);
                out += aesCharSet[idx];
        }
        return out;
};

const pkcs7Pad = (buffer: Buffer, blockSize = 16) => {
        const padding = blockSize - (buffer.length % blockSize);
        const pad = Buffer.alloc(padding, padding);
        return Buffer.concat([buffer, pad]);
};

const encryptPassword = (password: string, salt: string) => {
        if (!salt) throw new Error("missing salt");
        const prefix = randomString(64);
        const iv = randomString(16);
        const plain = pkcs7Pad(Buffer.from(prefix + password, "utf8"), 16);

        const cipher = crypto.createCipheriv(
                "aes-128-cbc",
                Buffer.from(salt, "utf8"),
                Buffer.from(iv, "utf8")
        );
        cipher.setAutoPadding(false);
        const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
        return encrypted.toString("base64");
};

export const loginLibrary = async (username: string, password: string) => {
        debug("loginLibrary start", { username, pwdLen: password.length });
        const { sessionFetch, jar } = createSessionFetch();

        const loginPage = await sessionFetch(casLoginURL);
        debug(
                "loginLibrary page status",
                loginPage.status,
                "url",
                loginPage.url
        );
        const html = await loginPage.text();
        debug("loginLibrary page length", html.length);
        const $ = loadHTML(html);

        const lt = $("input[name=lt]").attr("value")?.trim() ?? "";
        const execution =
                $("input[name=execution]").attr("value")?.trim() ?? "";
        const eventID =
                $("input[name=_eventId]").attr("value")?.trim() ?? "submit";
        const cllt =
                $("input[name=cllt][value=userNameLogin]")
                        .attr("value")
                        ?.trim() ?? "userNameLogin";
        const dllt =
                $("input[name=dllt]").attr("value")?.trim() ?? "generalLogin";
        const salt = $("#pwdEncryptSalt").attr("value")?.trim() ?? "";

        if (!salt || !execution) {
                debug("loginLibrary parse failed", {
                        saltFound: !!salt,
                        executionFound: !!execution,
                });
                throw new Error("图书馆登录页解析失败");
        }
        debug("loginLibrary page parsed", {
                ltLen: lt.length,
                executionLen: execution.length,
                saltLen: salt.length,
        });

        const encryptedPwd = encryptPassword(password, salt);
        const form = new URLSearchParams();
        form.set("username", username);
        form.set("password", encryptedPwd);
        form.set("passwordText", "");
        form.set("lt", lt);
        form.set("execution", execution);
        form.set("_eventId", eventID);
        form.set("cllt", cllt);
        form.set("dllt", dllt);

        const postUrl = loginPage.url || casLoginURL;
        const resp = await sessionFetch(postUrl, {
                method: "POST",
                headers: {
                        "content-type": "application/x-www-form-urlencoded",
                },
                body: form,
        });
        debug(
                "loginLibrary response status",
                resp.status,
                "redirect",
                resp.url
        );
        const respBody = await resp.text();
        debug("loginLibrary response body length", respBody.length);

        // 登录成功后应该重定向到图书馆域名
        if (!resp.url || !resp.url.includes("lib.csu.edu.cn")) {
                debug("loginLibrary failed, not redirected to library", resp.url);
                throw new Error("图书馆账号或密码错误");
        }

        const finalCookies = jar.toJSON();
        debug("loginLibrary success", { username, finalUrl: resp.url });
        if (finalCookies) {
                debug(
                        "loginLibrary cookies:",
                        JSON.stringify(
                                finalCookies.cookies.map((c: any) => ({
                                        key: c.key,
                                        domain: c.domain,
                                        path: c.path,
                                }))
                        )
                );
        }

        return { sessionFetch, jar };
};

export const loginLibraryOpac = async (
        username: string,
        password: string
) => {
        debug("loginLibraryOpac start", { username, pwdLen: password.length });
        const { sessionFetch, jar } = createSessionFetch();

        const loginPage = await sessionFetch(opacCasLoginURL);
        debug(
                "loginLibraryOpac page status",
                loginPage.status,
                "url",
                loginPage.url
        );
        const html = await loginPage.text();
        debug("loginLibraryOpac page length", html.length);
        const $ = loadHTML(html);

        const lt = $("input[name=lt]").attr("value")?.trim() ?? "";
        const execution =
                $("input[name=execution]").attr("value")?.trim() ?? "";
        const eventID =
                $("input[name=_eventId]").attr("value")?.trim() ?? "submit";
        const cllt =
                $("input[name=cllt][value=userNameLogin]")
                        .attr("value")
                        ?.trim() ?? "userNameLogin";
        const dllt =
                $("input[name=dllt]").attr("value")?.trim() ?? "generalLogin";
        const salt = $("#pwdEncryptSalt").attr("value")?.trim() ?? "";

        if (!salt || !execution) {
                debug("loginLibraryOpac parse failed", {
                        saltFound: !!salt,
                        executionFound: !!execution,
                });
                throw new Error("图书馆 OPAC 登录页解析失败");
        }
        debug("loginLibraryOpac page parsed", {
                ltLen: lt.length,
                executionLen: execution.length,
                saltLen: salt.length,
        });

        const encryptedPwd = encryptPassword(password, salt);
        const form = new URLSearchParams();
        form.set("username", username);
        form.set("password", encryptedPwd);
        form.set("passwordText", "");
        form.set("lt", lt);
        form.set("execution", execution);
        form.set("_eventId", eventID);
        form.set("cllt", cllt);
        form.set("dllt", dllt);

        const postUrl = loginPage.url || opacCasLoginURL;
        const resp = await sessionFetch(postUrl, {
                method: "POST",
                headers: {
                        "content-type": "application/x-www-form-urlencoded",
                },
                body: form,
                redirect: "manual",
        });
        const redirectLocation = resp.headers.get("location") ?? "";
        const nextUrl = redirectLocation
                ? new URL(redirectLocation, postUrl).toString()
                : "";
        debug("loginLibraryOpac response status", resp.status, {
                redirect: redirectLocation,
                resolvedRedirect: nextUrl,
        });
        if (!nextUrl) {
                throw new Error("图书馆 OPAC 账号或密码错误");
        }

        // 使用携带 ticket 的重定向链接访问 OPAC 域，期望种下 opac.lib.csu.edu.cn 的 Cookie
        const ticketResp = await sessionFetch(nextUrl, { redirect: "follow" });
        const finalUrl = ticketResp.url || nextUrl;
        debug("loginLibraryOpac ticket follow", {
                status: ticketResp.status,
                finalUrl,
        });

        // 再访问一次统一检索首页，通常会下发根路径的会话 Cookie，供后续接口使用
        const unifyIndexResp = await sessionFetch(
                "https://opac.lib.csu.edu.cn/find/unify/index",
                { redirect: "follow" }
        );
        debug("loginLibraryOpac unify index", {
                status: unifyIndexResp.status,
                url: unifyIndexResp.url,
        });

        // 访问站点根，尝试获取 SESSION/jwt 等根路径 Cookie
        const homeResp = await sessionFetch("https://opac.lib.csu.edu.cn/", {
                redirect: "follow",
        });
        debug("loginLibraryOpac home", {
                status: homeResp.status,
                url: homeResp.url,
        });

        const finalCookies = jar.toJSON();
        const cookies = Array.isArray(finalCookies.cookies)
                ? finalCookies.cookies
                : [];
        const hasOpacCookie = cookies.some((c: any) =>
                String(c.domain ?? "").includes("opac.lib.csu.edu.cn")
        );
        debug(
                "loginLibraryOpac cookies:",
                JSON.stringify(
                        cookies.map((c: any) => ({
                                key: c.key,
                                domain: c.domain,
                                path: c.path,
                        }))
                )
        );
        if (!hasOpacCookie && !finalUrl.includes("opac.lib.csu.edu.cn")) {
                throw new Error("未能获取图书馆 OPAC 登录态");
        }

        return { sessionFetch, jar };
};

const toStringArray = (value: unknown): string[] => {
        if (Array.isArray(value)) return value.map((v) => String(v)).filter(Boolean);
        if (value === undefined || value === null) return [];
        return [String(value)];
};

const parseBookSearch = (raw: any): LibraryBookSearchResult => {
        const data = raw?.data ?? {};
        const list = Array.isArray(data.searchResult)
                ? data.searchResult
                : [];
        const items: LibraryBookItem[] = list.map((row: any) => ({
                RecordId: Number(row.recordId ?? 0),
                Title: row.title ?? "",
                Author: row.author ?? "",
                Publisher: row.publisher ?? "",
                ISBNs: toStringArray(row.isbns),
                PublishYear: row.publishYear ?? "",
                CallNo: toStringArray(row.callNo),
                DocName: row.docName ?? "",
                PhysicalCount: Number(row.physicalCount ?? 0),
                OnShelfCount: Number(row.onShelfCountI ?? 0),
                Language: row.langCode ?? "",
                Country: row.countryCode ?? "",
                Subjects: row.subjectWord ?? "",
                Abstract: row.adstract ?? row.ddAbstract ?? "",
                Picture: row.pic ?? "",
        }));
        return {
                Total: Number(data.numFound ?? items.length ?? 0),
                Items: items,
        };
};

const parseBookCopies = (raw: any): LibraryBookItemCopiesResult => {
        const data = raw?.data ?? {};
        const list = Array.isArray(data.list) ? data.list : [];
        const items: LibraryBookItemCopy[] = list.map((row: any) => ({
                ItemId: Number(row.itemId ?? 0),
                CallNo: row.callNo ?? "",
                Barcode: row.barcode ?? "",
                LibCode: row.libCode ?? "",
                LibName: row.libName ?? "",
                LocationId: Number(row.locationId ?? 0),
                LocationName: row.locationName ?? "",
                CurLocationId: Number(row.curLocationId ?? 0),
                CurLocationName: row.curLocationName ?? "",
                Vol: row.vol ?? "",
                InDate: row.inDate ?? "",
                ProcessType: row.processType ?? "",
                ItemPolicyName: row.itemPolicyName ?? "",
                ShelfNo: row.shelfNo ?? "",
        }));
        return {
                Total: Number(data.totalCount ?? items.length ?? 0),
                Items: items,
        };
};

const parseSeatCampus = (html: string): LibrarySeatCampusResult => {
        const $ = loadHTML(html);
        const campuses: LibrarySeatCampus[] = [];
        $(".xiaoqu .rooms").each((_, el) => {
                const $el = loadHTML(el);
                const name = $el(".zh b").first().text().trim();
                const quotaText = $el(".zh b").eq(1).text().trim();
                // quotaText example: 今日剩余1208，总量2416
                let remaining = 0;
                let total = 0;
                const m = /今日剩余\s*(\d+)[^0-9]+总量\s*(\d+)/.exec(quotaText);
                if (m) {
                        remaining = Number(m[1]);
                        total = Number(m[2]);
                }
                const seatHref = $el(".seat a").attr("href") ?? "";
                const areaIdMatch = /area\/(\d+)/.exec(seatHref);
                const areaId = areaIdMatch ? areaIdMatch[1] : "";
                if (name && areaId) {
                        campuses.push({
                                Name: name,
                                Remaining: remaining,
                                Total: total,
                                SeatApi: `${LIB_SEAT_AREA_API_PREFIX}${areaId}`,
                                Floors: [],
                        });
                }
        });
        return { Campuses: campuses };
};

export const authenticatedLibraryRequest = async (
        username: string,
        password: string,
        method: string,
        url: string,
        body: URLSearchParams | undefined
) => {
        debug("authenticatedLibraryRequest start", { username, method, url });
        const { sessionFetch } = await loginLibrary(username, password);
        const resp = await sessionFetch(url, {
                method,
                headers: {
                        "content-type": "application/x-www-form-urlencoded",
                },
                body,
        });
        debug("authenticatedLibraryRequest response", {
                url: resp.url,
                status: resp.status,
        });
        return resp;
};

export const searchLibraryBooks = async (user: JwcUser, kw: string) => {
        debug("searchLibraryBooks start", { id: user.id, kw });
        const payload = {
                docCode: [null],
                searchFieldContent: kw,
                searchField: "keyWord",
                matchMode: "2",
                resourceType: [],
                subject: [],
                discode1: [],
                publisher: [],
                libCode: [],
                locationId: [],
                eCollectionIds: [],
                neweCollectionIds: [],
                curLocationId: [],
                campusId: [],
                kindNo: [],
                collectionName: [],
                author: [],
                langCode: [],
                countryCode: [],
                publishBegin: null,
                publishEnd: null,
                coreInclude: [],
                ddType: [],
                verifyStatus: [],
                group: [],
                sortField: "relevance",
                sortClause: "asc",
                page: 1,
                rows: 10,
                onlyOnShelf: null,
                searchItems: null,
                newCoreInclude: [],
                customSub: [],
                customSub0: [],
                indexSearch: 1,
        };
        const { sessionFetch } = await loginLibraryOpac(user.id, user.pwd);
        debug("searchLibraryBooks payload", payload);
        const resp = await sessionFetch(OPAC_UNIFY_SEARCH_URL, {
                method: "POST",
                headers: {
                        "content-type": "application/json",
                        accept: "application/json, text/plain, */*",
                        origin: "https://opac.lib.csu.edu.cn",
                        referer: "https://opac.lib.csu.edu.cn/",
                        "x-lang": "CHI",
                        groupcode: "800388",
                        "sec-fetch-mode": "cors",
                        "sec-fetch-site": "same-origin",
                },
                body: JSON.stringify(payload),
        });
        const text = await resp.text();
        debug("searchLibraryBooks response", {
                status: resp.status,
                url: resp.url,
                bodyPreview: text.slice(0, 200),
                bodyLen: text.length,
        });
        // 打印完整响应方便排查
        debug("searchLibraryBooks raw body", text);
        let parsed: LibraryBookSearchResult | undefined;
        try {
                const json = JSON.parse(text);
                if (json?.success === true) {
                        parsed = parseBookSearch(json);
                } else {
                        debug("searchLibraryBooks response not success", {
                                success: json?.success,
                                message: json?.message,
                                errCode: json?.errCode,
                        });
                }
        } catch (e) {
                debug("searchLibraryBooks parse error", e);
        }
        return { status: resp.status, body: text, parsed };
};

export const fetchBookCopies = async (user: JwcUser, recordId: string) => {
        debug("fetchBookCopies start", { id: user.id, recordId });
        const payload = {
                page: 1,
                rows: 10,
                entrance: null,
                recordId,
                isUnify: true,
                sortType: 0,
        };
        const { sessionFetch } = await loginLibraryOpac(user.id, user.pwd);
        debug("fetchBookCopies payload", payload);
        const resp = await sessionFetch(OPAC_GROUP_ITEMS_URL, {
                method: "POST",
                headers: {
                        "content-type": "application/json",
                        accept: "application/json, text/plain, */*",
                        origin: "https://opac.lib.csu.edu.cn",
                        referer: "https://opac.lib.csu.edu.cn/",
                        "x-lang": "CHI",
                        groupcode: "800388",
                        "sec-fetch-mode": "cors",
                        "sec-fetch-site": "same-origin",
                },
                body: JSON.stringify(payload),
        });
        const text = await resp.text();
        debug("fetchBookCopies response", {
                status: resp.status,
                url: resp.url,
                bodyPreview: text.slice(0, 200),
                bodyLen: text.length,
        });
        debug("fetchBookCopies raw body", text);
        let parsed: LibraryBookItemCopiesResult | undefined;
        try {
                const json = JSON.parse(text);
                if (json?.success === true) {
                        parsed = parseBookCopies(json);
                } else {
                        debug("fetchBookCopies response not success", {
                                success: json?.success,
                                message: json?.message,
                                errCode: json?.errCode,
                        });
                }
        } catch (e) {
                debug("fetchBookCopies parse error", e);
        }
        return { status: resp.status, body: text, parsed };
};

export const fetchSeatCampuses = async (): Promise<{
        status: number;
        body: string;
        parsed?: LibrarySeatCampusResult;
}> => {
        debug("fetchSeatCampuses start");
        const { sessionFetch } = createSessionFetch();
        const resp = await sessionFetch(LIB_SEAT_HOME_URL, { method: "GET" });
        const html = await resp.text();
        debug("fetchSeatCampuses response", {
                status: resp.status,
                url: resp.url,
                bodyLen: html.length,
                preview: html.slice(0, 200),
        });
        let parsed: LibrarySeatCampusResult | undefined;
        try {
                parsed = parseSeatCampus(html);
                // 逐个获取楼层信息并填充
                parsed.Campuses = await Promise.all(
                        parsed.Campuses.map(async (campus) => {
                                try {
                                        const areaIdMatch =
                                                /\/(\d+)$/.exec(campus.SeatApi);
                                        const areaId = areaIdMatch
                                                ? areaIdMatch[1]
                                                : "";
                                        const seatPageUrl = `https://libzw.csu.edu.cn/home/web/seat/area/${areaId}`;
                                        // 先访问座位页面以获取 PHPSESSID 等 cookie
                                        const seatPageResp =
                                                await sessionFetch(
                                                        seatPageUrl,
                                                        { method: "GET" }
                                                );
                                        debug(
                                                "fetchSeatCampuses seat page",
                                                {
                                                        url: seatPageResp.url,
                                                        status: seatPageResp.status,
                                                }
                                        );
                                        const areaResp = await sessionFetch(
                                                campus.SeatApi,
                                                {
                                                        method: "GET",
                                                        headers: {
                                                                accept: "application/json, text/javascript, */*; q=0.01",
                                                                referer: seatPageUrl,
                                                                "x-requested-with":
                                                                        "XMLHttpRequest",
                                                        },
                                                }
                                        );
                                        const areaText = await areaResp.text();
                                        debug(
                                                "fetchSeatCampuses area resp",
                                                {
                                                        api: campus.SeatApi,
                                                        status: areaResp.status,
                                                        bodyPreview:
                                                                areaText.slice(
                                                                        0,
                                                                        200
                                                                ),
                                                }
                                        );
                                        const areaJson = JSON.parse(areaText);
                                        const list = areaJson?.data?.list;
                                        const childArea = Array.isArray(
                                                list?.childArea
                                        )
                                                ? list.childArea
                                                : [];
                                        const floors = childArea.map(
                                                (f: any) => ({
                                                        Id: Number(
                                                                f.id ?? 0
                                                        ),
                                                        Name: f.name ?? "",
                                                        Total: Number(
                                                                f.TotalCount ??
                                                                        0
                                                        ),
                                                        Unavailable: Number(
                                                                f.UnavailableSpace ??
                                                                        0
                                                        ),
                                                        Remaining: Math.max(
                                                                0,
                                                                Number(
                                                                        f.TotalCount ??
                                                                                0
                                                                ) -
                                                                        Number(
                                                                                f.UnavailableSpace ??
                                                                                        0
                                                                        )
                                                        ),
                                                        SeatUrl: `https://libzw.csu.edu.cn/home/web/seat/area/${f.id}`,
                                                })
                                        );
                                        return { ...campus, Floors: floors };
                                } catch (e) {
                                        debug(
                                                "fetchSeatCampuses area parse error",
                                                campus.SeatApi,
                                                e
                                        );
                                        return campus;
                                }
                        })
                );
        } catch (e) {
                debug("fetchSeatCampuses parse error", e);
        }
        return { status: resp.status, body: html, parsed };
};

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

const parseDbList = (list: Cheerio<AnyNode>, base: string): LibraryDbEntry[] => {
        const entries: LibraryDbEntry[] = [];
        list.find(".lib-data-body .row").each((_, row) => {
                const $row = loadHTML(row);
                const idx = $row(".num").text().trim();
                const nameAnchor = $row("a[title]").first();
                const name = nameAnchor.text().trim();
                const href = nameAnchor.attr("href") || "";
                const detailUrl = href ? new URL(href, base).toString() : "";
                const accessLink = $row("a[href^='javascript:jinru']").attr(
                        "href"
                );
                let accessId = "";
                if (accessLink) {
                        const m = /jinru\('[^']*','([^']+)'/.exec(accessLink);
                        if (m?.[1]) accessId = m[1];
                } else if (href.includes("id=")) {
                        accessId = href.split("id=").pop() || "";
                }
                if (name) {
                        entries.push({
                                Index: idx || String(entries.length + 1),
                                Name: name,
                                DetailUrl: detailUrl,
                                AccessId: accessId,
                        });
                }
        });
        return entries;
};

export const searchLibraryDb = async (
        elecName: string
): Promise<LibraryDbSearchResult> => {
        debug("searchLibraryDb start", { elecName });
        const form = new URLSearchParams();
        form.set("elecName", elecName);
        form.set("typeZm", "");
        form.set("sortType", "-1");
        form.set("elecMuTypes", "");
        form.set("category", "");
        form.set("language", "");
        form.set("subject", "");

        const resp = await fetch(LIB_DB_SEARCH_URL, {
                method: "POST",
                headers: {
                        "content-type": "application/x-www-form-urlencoded",
                },
                body: form,
        });
        debug("searchLibraryDb status", resp.status, "url", resp.url);
        const html = await resp.text();
        const $ = loadHTML(html);

        const lists = $(".lib-data-list");
        const chinese = parseDbList(lists.eq(0), "https://libdb.csu.edu.cn/");
        const foreign = parseDbList(lists.eq(1), "https://libdb.csu.edu.cn/");

        debug(
                "searchLibraryDb parsed",
                "cn",
                chinese.length,
                "foreign",
                foreign.length
        );
        return { Chinese: chinese, Foreign: foreign };
};
