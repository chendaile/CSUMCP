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
export declare const searchBus: ({ date, startStation, endStation, startTimeLeft, startTimeRight, }: BusRequest) => Promise<BusEntry[]>;
