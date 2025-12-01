import {
        createSessionFetch,
        encryptPassword,
        type SessionFetch,
} from "./auth.js";
import { load as loadHTML } from "cheerio";
import { logger } from "../logger.js";

const ECARD_SERVICE_URL =
        "https://ecard.csu.edu.cn/berserker-auth/cas/login/wisedu?targetUrl=https://ecard.csu.edu.cn/plat-pc/?name=loginTransit";
const ECARD_CAS_LOGIN_URL = `https://ca.csu.edu.cn/authserver/login?service=${encodeURIComponent(
        ECARD_SERVICE_URL
)}`;

const debug = (...args: unknown[]) => {
        logger.info("[ecard]", ...args);
};

export const loginEcard = async (
        username: string,
        password: string
): Promise<{
        sessionFetch: SessionFetch;
        finalUrl: string;
        token: string;
}> => {
        debug("loginEcard start", { username, pwdLen: password.length });
        const { sessionFetch, jar } = createSessionFetch();

        const loginPage = await sessionFetch(ECARD_CAS_LOGIN_URL);
        debug("loginEcard page status", loginPage.status, "url", loginPage.url);
        const html = await loginPage.text();
        debug("loginEcard page length", html.length);
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
                debug("loginEcard page parse failed", {
                        saltFound: !!salt,
                        executionFound: !!execution,
                });
                throw new Error("校园卡登录页解析失败");
        }
        debug("loginEcard page parsed", {
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

        const postUrl = loginPage.url || ECARD_CAS_LOGIN_URL;
        const resp = await sessionFetch(postUrl, {
                method: "POST",
                headers: {
                        "content-type": "application/x-www-form-urlencoded",
                },
                body: form,
        });
        debug("loginEcard response status", resp.status, "redirect", resp.url);
        const respBody = await resp.text();
        debug("loginEcard response body length", respBody.length);

        if (!resp.url || !resp.url.includes("ecard.csu.edu.cn")) {
                debug("loginEcard failed, not redirected to ecard", resp.url);
                throw new Error("校园卡账号或密码错误");
        }

        const finalCookies = jar.toJSON();
        if (finalCookies) {
                debug(
                        "loginEcard cookies:",
                        JSON.stringify(
                                finalCookies.cookies.map((c: any) => ({
                                        key: c.key,
                                        domain: c.domain,
                                        path: c.path,
                                }))
                        )
                );
        }

        let token = "";
        try {
                token =
                        new URL(resp.url || ECARD_SERVICE_URL).searchParams.get(
                                "synjones-auth"
                        ) || "";
        } catch {
                token = "";
        }

        return { sessionFetch, finalUrl: resp.url, token };
};

export const fetchCardInfo = async (
        username: string,
        password: string
): Promise<{
        status: number;
        body: string;
        parsed?: any;
        simplified?: any;
        finalUrl?: string;
}> => {
        const { sessionFetch, finalUrl, token } = await loginEcard(
                username,
                password
        );
        // 访问登录后的目标页面以确保凭证落盘
        await sessionFetch(finalUrl || ECARD_SERVICE_URL, { method: "GET" });
        const url =
                "https://ecard.csu.edu.cn/berserker-app/ykt/tsm/queryCard?scene=recharge&synAccessSource=pc";
        const headers: Record<string, string> = {
                referer: "https://ecard.csu.edu.cn/plat-pc/",
        };
        if (token) {
                headers["synjones-auth"] = token;
                headers["authorization"] = token;
        }
        const resp = await sessionFetch(url, { method: "GET", headers });
        const body = await resp.text();
        let parsed: any;
        let simplified: any;
        try {
                parsed = JSON.parse(body);
                simplified = simplifyCardResponse(parsed);
        } catch {
                // ignore parse failure, return raw body
        }
        debug("fetchCardInfo response", {
                status: resp.status,
                url: resp.url,
                bodyPreview: body.slice(0, 200),
        });
        return { status: resp.status, body, parsed, simplified, finalUrl };
};

export interface EcardTurnoverQuery {
        timeFrom: string;
        timeTo: string;
        amountFrom?: number;
        amountTo?: number;
        size?: number;
        current?: number;
}

export const fetchCardTurnover = async (
        username: string,
        password: string,
        params: EcardTurnoverQuery
): Promise<{
        status: number;
        body: string;
        parsed?: any;
        simplified?: any;
        finalUrl?: string;
}> => {
        const { sessionFetch, finalUrl, token } = await loginEcard(
                username,
                password
        );
        await sessionFetch(finalUrl || ECARD_SERVICE_URL, { method: "GET" });

        const baseUrl =
                "https://ecard.csu.edu.cn/berserker-search/search/personal/turnover";
        const qs = new URLSearchParams();
        if (params.timeFrom) qs.set("timeFrom", params.timeFrom);
        if (params.timeTo) qs.set("timeTo", params.timeTo);
        if (params.amountFrom !== undefined && params.amountFrom !== null)
                qs.set("amountFrom", String(Math.round(params.amountFrom * 100)));
        if (params.amountTo !== undefined && params.amountTo !== null)
                qs.set("amountTo", String(Math.round(params.amountTo * 100)));
        qs.set("size", "100");
        qs.set("current", "1");
        qs.set("synAccessSource", "pc");
        const url = `${baseUrl}?${qs.toString()}`;

        const headers: Record<string, string> = {
                referer: "https://ecard.csu.edu.cn/plat-pc/",
        };
        if (token) {
                headers["synjones-auth"] = `bearer ${token}`;
                headers["authorization"] = `bearer ${token}`;
        }

        const resp = await sessionFetch(url, { method: "GET", headers });
        const text = await resp.text();
        let parsed: any;
        let simplified: any;
        try {
                parsed = JSON.parse(text);
                simplified = simplifyTurnoverResponse(parsed);
        } catch {
                // ignore parse failure
        }
        debug("fetchCardTurnover response", {
                status: resp.status,
                url: resp.url,
                bodyPreview: text.slice(0, 200),
        });
        return {
                status: resp.status,
                body: text,
                parsed,
                simplified,
                finalUrl,
        };
};

const centsToAmount = (value: any): number => {
        if (typeof value !== "number") return 0;
        return Math.round(value) / 100;
};

const simplifyCardResponse = (raw: any) => {
        if (!raw || typeof raw !== "object") return null;
        const data = raw.data ?? {};
        const cards = Array.isArray(data.card) ? data.card : [];
        const simplifiedCards = cards.map((c: any) => {
                const accinfo = Array.isArray(c.accinfo) ? c.accinfo : [];
                return {
                        studentId:
                                c.card_name_en ||
                                c.sno ||
                                data.sno ||
                                c.account ||
                                "",
                        name: c.name || "",
                        phone: c.phone || "",
                        account: c.account || "",
                        cardName: c.card_name || "",
                        cardType: c.cardtype || "",
                        balance: centsToAmount(c.db_balance),
                        elecBalance: centsToAmount(c.elec_accamt),
                        unsettled: centsToAmount(c.unsettle_amount),
                        debit: centsToAmount(c.debitamt),
                        autoTransfer: {
                                enabled: c.autotrans_flag === 1,
                                amount: centsToAmount(c.autotrans_amt),
                                limit: centsToAmount(c.autotrans_limite),
                        },
                        frozen: c.freezeflag === 1,
                        lost: c.lostflag === 1,
                        expireDate: c.expdate || "",
                        cert: c.cert || "",
                        phoneMasked: c.phone || "",
                        accInfo: accinfo.map((a: any) => ({
                                name: a.name || "",
                                type: a.type || "",
                                balance: centsToAmount(a.balance),
                        })),
                };
        });
        return {
                code: raw.code ?? null,
                success: raw.success ?? false,
                retcode: data.retcode ?? "",
                cards: simplifiedCards,
        };
};

const simplifyTurnoverResponse = (raw: any) => {
        if (!raw || typeof raw !== "object") return null;
        const data = raw.data ?? {};
        const records = Array.isArray(data.records) ? data.records : [];
        const simplifiedRecords = records.map((r: any) => ({
                fromAccount: r.fromAccount || "",
                jndatetime: r.jndatetime || "",
                effectdate: r.effectdate || "",
                effectdateStr: r.effectdateStr || "",
                jndatetimeStr: r.jndatetimeStr || "",
                resume: r.resume || "",
                turnoverType: r.turnoverType || "",
                payName: r.payName || "",
                payIcon: r.payIcon || "",
                amount: centsToAmount(r.tranamt),
                remark: r.remark || "",
                userName: r.userName || "",
                toMerchant: r.toMerchant || "",
                sno: r.sno || "",
        }));
        return {
                code: raw.code ?? null,
                success: raw.success ?? false,
                total: data.total ?? simplifiedRecords.length,
                size: data.size ?? 0,
                current: data.current ?? 0,
                pages: data.pages ?? 0,
                records: simplifiedRecords,
        };
};
