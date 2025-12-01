import crypto from "crypto";
import fetch from "node-fetch";
import fetchCookie from "fetch-cookie";
import { load as loadHTML } from "cheerio";
import { CookieJar } from "tough-cookie";
import { logger } from "../logger.js";
const jwcSSOEndpoint = "http://csujwc.its.csu.edu.cn/sso.jsp";
const casLoginURL = `https://ca.csu.edu.cn/authserver/login?service=${encodeURIComponent(jwcSSOEndpoint)}`;
const aesCharSet = "ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678";
const debug = (...args) => {
    logger.info("[auth]", ...args);
};
export const createSessionFetch = () => {
    const jar = new CookieJar();
    const sessionFetch = fetchCookie(fetch, jar);
    debug("session created with empty cookie jar");
    return { sessionFetch, jar };
};
export const randomString = (length) => {
    if (length <= 0)
        return "";
    let out = "";
    for (let i = 0; i < length; i += 1) {
        const idx = crypto.randomInt(0, aesCharSet.length);
        out += aesCharSet[idx];
    }
    return out;
};
export const pkcs7Pad = (buffer, blockSize = 16) => {
    const padding = blockSize - (buffer.length % blockSize);
    const pad = Buffer.alloc(padding, padding);
    return Buffer.concat([buffer, pad]);
};
export const encryptPassword = (password, salt) => {
    if (!salt)
        throw new Error("missing salt");
    const prefix = randomString(64);
    const iv = randomString(16);
    const plain = pkcs7Pad(Buffer.from(prefix + password, "utf8"), 16);
    const cipher = crypto.createCipheriv("aes-128-cbc", Buffer.from(salt, "utf8"), Buffer.from(iv, "utf8"));
    cipher.setAutoPadding(false);
    const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
    return encrypted.toString("base64");
};
export const login = async (username, password) => {
    debug("login start", { username, pwdLen: password.length });
    const { sessionFetch, jar } = createSessionFetch();
    const loginPage = await sessionFetch(casLoginURL);
    debug("login page status", loginPage.status, "url", loginPage.url);
    const html = await loginPage.text();
    debug("login page length", html.length);
    const $ = loadHTML(html);
    const lt = $("input[name=lt]").attr("value")?.trim() ?? "";
    const execution = $("input[name=execution]").attr("value")?.trim() ?? "";
    const eventID = $("input[name=_eventId]").attr("value")?.trim() ?? "submit";
    const cllt = $("input[name=cllt][value=userNameLogin]")
        .attr("value")
        ?.trim() ?? "userNameLogin";
    const dllt = $("input[name=dllt]").attr("value")?.trim() ?? "generalLogin";
    const salt = $("#pwdEncryptSalt").attr("value")?.trim() ?? "";
    if (!salt || !execution) {
        debug("login page parse failed", {
            saltFound: !!salt,
            executionFound: !!execution,
        });
        throw new Error("登录页解析失败");
    }
    debug("login page parsed", {
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
    debug("login response status", resp.status, "redirect", resp.url);
    const respBody = await resp.text();
    debug("login response body length", respBody.length);
    // 登录成功后应该重定向到教务系统，检查最终 URL
    if (!resp.url || !resp.url.includes("csujwc.its.csu.edu.cn")) {
        debug("login failed, not redirected to JWC", resp.url);
        throw new Error("账号或密码错误");
    }
    // 打印最终的 cookies（应该包含教务系统的有效登录态 cookies）
    const finalCookies = jar.toJSON();
    debug("login success", { username, finalUrl: resp.url });
    if (finalCookies) {
        debug("login final cookies count:", finalCookies.cookies.length);
        debug("login final cookies:", JSON.stringify(finalCookies.cookies.map((c) => ({
            key: c.key,
            domain: c.domain,
            path: c.path,
        }))));
    }
    return { sessionFetch, jar };
};
export const authenticatedRequest = async (username, password, method, url, body) => {
    debug("authenticatedRequest start", { username, method, url });
    const { sessionFetch } = await login(username, password);
    const resp = await sessionFetch(url, {
        method,
        headers: {
            "content-type": "application/x-www-form-urlencoded",
        },
        body,
    });
    debug("authenticatedRequest response", {
        url: resp.url,
        status: resp.status,
    });
    return resp;
};
