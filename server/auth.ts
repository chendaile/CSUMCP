import crypto from "crypto";
import fetch from "node-fetch";
import fetchCookie from "fetch-cookie";
import { load as loadHTML } from "cheerio";
import { CookieJar } from "tough-cookie";

type SessionFetch = (...args: any[]) => Promise<any>;

const casLoginURL = "https://ca.csu.edu.cn/authserver/login";
const aesCharSet = "ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678";

const createSessionFetch = (): {
  sessionFetch: SessionFetch;
  jar: CookieJar;
} => {
  const jar = new CookieJar();
  const sessionFetch = fetchCookie(fetch as any, jar) as SessionFetch;
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

export const login = async (username: string, password: string) => {
        const { sessionFetch } = createSessionFetch();

        const loginPage = (await sessionFetch(casLoginURL)) as any;
        const html = await loginPage.text();
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
                throw new Error("登录页解析失败");
        }

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

        const resp = (await sessionFetch(
                casLoginURL,
                {
                        method: "POST",
                        headers: {
                                "content-type": "application/x-www-form-urlencoded",
                        },
                        body: form,
                } as any,
        )) as any;
        await resp.text(); // consume body to keep jar consistent

        if (!resp.url || !resp.url.includes("ca.csu.edu.cn")) {
                throw new Error("账号或密码错误");
        }

        return sessionFetch;
};

export const authenticatedRequest = async (
        username: string,
        password: string,
        method: string,
        url: string,
        body: URLSearchParams | undefined
) => {
        const sessionFetch = await login(username, password);
        return sessionFetch(
                url,
                {
                        method,
                        headers: {
                                "content-type": "application/x-www-form-urlencoded",
                        },
                        body,
                } as any,
        );
};
