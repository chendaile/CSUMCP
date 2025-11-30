import fetch from "node-fetch";
const BUS_SEARCH_URL = "https://wxxy.csu.edu.cn/regularbus/wap/default/index-ajax";
const debug = (...args) => {
    console.log(new Date().toISOString(), "[bus]", ...args);
};
export const searchBus = async ({ date, startStation, endStation, startTimeLeft, startTimeRight, }) => {
    debug("searchBus start", {
        date,
        startStation,
        endStation,
        startTimeLeft,
        startTimeRight,
    });
    const form = new URLSearchParams();
    form.set("bus_id", "2");
    form.set("type", "");
    form.set("date", date ?? "");
    form.set("cfz", startStation ?? "");
    form.set("ddz", endStation ?? "");
    form.set("fcsjStart", startTimeLeft ?? "");
    form.set("fcsjEnd", startTimeRight ?? "");
    const resp = await fetch(BUS_SEARCH_URL, {
        method: "POST",
        headers: {
            "Content-type": "application/x-www-form-urlencoded",
        },
        body: form,
    });
    debug("searchBus response status", resp.status, "url", resp.url);
    if (!resp.ok) {
        throw new Error(`Bus request failed: ${resp.status}`);
    }
    const data = (await resp.json());
    const buses = [];
    data?.d?.data?.forEach((entry) => {
        buses.push({
            StartTime: entry.start,
            Station: entry.station,
        });
    });
    debug("searchBus parsed buses", buses.length);
    return buses;
};
