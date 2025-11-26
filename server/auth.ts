import crypto from "crypto";
import fetch, { type RequestInfo, type RequestInit, type Response } from "node-fetch";
import fetchCookie from "fetch-cookie";
import { load as loadHTML } from "cheerio";
import { CookieJar } from "tough-cookie";

type SessionFetch = (input: RequestInfo, init?: RequestInit) => Promise<Response>;

const casLoginURL = "https://ca.csu.edu.cn/authserver/login";
const aesCharSet = "ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678";

const debug = (...args: unknown[]) => {
  console.log(new Date().toISOString(), "[auth]", ...args);
};

const createSessionFetch = (): {
  sessionFetch: SessionFetch;
  jar: CookieJar;
} => {
  const jar = new CookieJar();
  const sessionFetch = fetchCookie(fetch as unknown as SessionFetch, jar) as SessionFetch;
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
    Buffer.from(iv, "utf8"),
  );
  cipher.setAutoPadding(false);
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  return encrypted.toString("base64");
};

export const login = async (username: string, password: string) => {
  debug("login start", { username, pwdLen: password.length });
  const { sessionFetch } = createSessionFetch();

  const loginPage = await sessionFetch(casLoginURL);
  debug("login page status", loginPage.status, "url", loginPage.url);
  const html = await loginPage.text();
  debug("login page length", html.length);
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
    debug("login page parse failed", { saltFound: !!salt, executionFound: !!execution });
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
  await resp.text(); // consume body to keep jar consistent

  if (!resp.url || !resp.url.includes("ca.csu.edu.cn")) {
    debug("login failed, unexpected redirect", resp.url);
    throw new Error("账号或密码错误");
  }

  debug("login success", { username });
  return sessionFetch;
};

export const authenticatedRequest = async (
  username: string,
  password: string,
  method: string,
  url: string,
  body: URLSearchParams | undefined,
) => {
  debug("authenticatedRequest start", { username, method, url });
  const sessionFetch = await login(username, password);
  const resp = await sessionFetch(
    url,
    {
      method,
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body,
    },
  );
  debug("authenticatedRequest response", { url: resp.url, status: resp.status });
  return resp;
};
