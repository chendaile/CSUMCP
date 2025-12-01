import fetch from "node-fetch";
import { logger } from "../logger.js";

export interface BusRequest {
  date?: string;
  startStation?: string;
  endStation?: string;
  startTimeLeft?: string;
  startTimeRight?: string;
}

export interface BusEntry {
  id?: string;
  StartTime: string;
  Station: string[];
  Cross?: string[];
  DetailUrl?: string;
}

interface RawBusResponse {
  d?: {
    data?: {
      id?: string;
      start: string;
      station: string[];
      cross?: string[];
    }[];
  };
}

const BUS_SEARCH_URL = "https://wxxy.csu.edu.cn/regularbus/wap/default/index-ajax";

const debug = (...args: unknown[]) => {
  logger.info("[bus]", ...args);
};

export const searchBus = async ({
  date,
  startStation,
  endStation,
  startTimeLeft,
  startTimeRight,
}: BusRequest): Promise<BusEntry[]> => {
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
  const data = (await resp.json()) as RawBusResponse;
  const buses: BusEntry[] = [];
  const formatDate = (d?: string) => {
    if (!d) return "";
    const parts = d.split("-");
    if (parts.length !== 3) return "";
    const [y, m, day] = parts;
    return `${y}年${m.padStart(2, "0")}月${day.padStart(2, "0")}日`;
  };
  const friendlyDate = formatDate(date);

  data?.d?.data?.forEach((entry) => {
    const detailUrl =
      entry.id && friendlyDate
        ? `https://wxxy.csu.edu.cn/site/shuttleBus/detail?id=${entry.id}&time=${encodeURIComponent(
            friendlyDate
          )}`
        : undefined;
    buses.push({
      id: entry.id,
      StartTime: entry.start,
      Station: entry.station,
      Cross: entry.cross,
      DetailUrl: detailUrl,
    });
  });
  debug("searchBus parsed buses", buses.length);
  return buses;
};
