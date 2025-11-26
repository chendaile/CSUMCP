declare module "fetch-cookie" {
  import type { CookieJar } from "tough-cookie";
  import type { RequestInfo, RequestInit, Response } from "node-fetch";

  // Simplified typing to stay compatible with node-fetch and built-in fetch.
  type FetchLike = (input: RequestInfo, init?: RequestInit) => Promise<Response>;

  export default function fetchCookie(fetch: FetchLike, jar?: CookieJar): FetchLike;
}
