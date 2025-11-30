export interface BusRequest {
    date?: string;
    startStation?: string;
    endStation?: string;
    startTimeLeft?: string;
    startTimeRight?: string;
}
export interface BusEntry {
    StartTime: string;
    Station: string[];
}
export declare const searchBus: ({ date, startStation, endStation, startTimeLeft, startTimeRight, }: BusRequest) => Promise<BusEntry[]>;
