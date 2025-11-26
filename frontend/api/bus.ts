import { requestJSON } from "./client";
import type { BusResponse } from "./types";

const encode = (value: string) => encodeURIComponent(value.trim());

export const searchBus = async (
        params: {
                date: string;
                startStation: string;
                endStation: string;
                startTimeLeft: string;
                startTimeRight: string;
        },
        baseUrl?: string
) => {
        const {
                date,
                startStation,
                endStation,
                startTimeLeft,
                startTimeRight,
        } = params;

        return requestJSON<BusResponse>(
                `/bus/${encode(date)}/${encode(startStation)}/${encode(
                        endStation
                )}/${encode(startTimeLeft)}/${encode(startTimeRight)}`,
                baseUrl
        );
};
