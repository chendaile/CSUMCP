const defaultBase = "/api";

const trimSlash = (value: string) => value.replace(/\/+$/, "");
const normalizePath = (value: string) => value.replace(/^\/+/, "");

export const getDefaultApiBase = () => defaultBase;

export const requestJSON = async <T>(
        path: string,
        baseUrl = defaultBase,
        init?: RequestInit
): Promise<T> => {
        const url = `${trimSlash(baseUrl)}/${normalizePath(path)}`;
        const response = await fetch(url, {
                ...init,
                headers: {
                        Accept: "application/json",
                        ...(init?.headers || {}),
                },
        });

        if (!response.ok) {
                const message = `Request failed (${response.status} ${response.statusText})`;
                throw new Error(message);
        }

        return (await response.json()) as T;
};
