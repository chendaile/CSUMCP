declare module "fetch-cookie" {
  import type { CookieJar } from "tough-cookie";

  // Simplified typing to stay compatible with node-fetch and built-in fetch.
  type AnyFetch = (...args: any[]) => Promise<any>;

  export default function fetchCookie(fetch: AnyFetch, jar?: CookieJar): AnyFetch;
}
