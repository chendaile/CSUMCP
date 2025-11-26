import express from "express";
import { classes, grade, rank } from "./jwc.js";
import { searchBus } from "./bus.js";

const app = express();
const PORT = process.env.PORT || 12000;

const maskSensitive = (value?: string) => {
        if (!value) return "";
        if (value.length <= 2) return "***";
        return `${value.slice(0, 2)}***${value.slice(-1)}`;
};

const logDebug = (...args: unknown[]) => {
        console.log(new Date().toISOString(), "[server]", ...args);
};

app.use((req, res, next) => {
        const startedAt = Date.now();
        const maskedParams = { ...req.params };
        if ("pwd" in maskedParams) {
                maskedParams.pwd = maskSensitive(req.params.pwd);
        }
        logDebug("incoming", req.method, req.originalUrl, {
                query: req.query,
                params: maskedParams,
        });
        res.on("finish", () => {
                logDebug(
                        "completed",
                        req.method,
                        req.originalUrl,
                        "status:",
                        res.statusCode,
                        "duration:",
                        `${Date.now() - startedAt}ms`
                );
        });
        next();
});

app.get("/", (_req, res) => {
        res.json({
                service: "CSU MCP",
                routes: [
                        "/api/jwc/:id/:pwd/grade/:term",
                        "/api/jwc/:id/:pwd/rank",
                        "/api/jwc/:id/:pwd/class/:term/:week",
                        "/api/bus/:date/:startstation/:endstation/:starttimeleft/:starttimeright",
                ],
        });
});

app.get("/api/jwc/:id/:pwd/grade/:term", async (req, res) => {
        try {
                const grades = await grade(
                        { id: req.params.id, pwd: req.params.pwd },
                        req.params.term
                );
                res.json({ StateCode: 1, Error: "", Grades: grades });
        } catch (error) {
                const message =
                        error instanceof Error ? error.message : String(error);
                console.error("[server][grade] error:", message, error);
                res.json({ StateCode: -1, Error: message, Grades: [] });
        }
});

app.get("/api/jwc/:id/:pwd/rank", async (req, res) => {
        try {
                const ranks = await rank({
                        id: req.params.id,
                        pwd: req.params.pwd,
                });
                res.json({ StateCode: 1, Error: "", Rank: ranks });
        } catch (error) {
                const message =
                        error instanceof Error ? error.message : String(error);
                console.error("[server][rank] error:", message, error);
                res.json({ StateCode: -1, Error: message, Rank: [] });
        }
});

app.get("/api/jwc/:id/:pwd/class/:term/:week", async (req, res) => {
        try {
                const { classes: cls, startWeekDay } = await classes(
                        { id: req.params.id, pwd: req.params.pwd },
                        req.params.term,
                        req.params.week
                );
                res.json({
                        StateCode: 1,
                        Error: "",
                        Class: cls,
                        StartWeekDay: startWeekDay,
                });
        } catch (error) {
                const message =
                        error instanceof Error ? error.message : String(error);
                console.error("[server][class] error:", message, error);
                res.json({
                        StateCode: -1,
                        Error: message,
                        Class: [],
                        StartWeekDay: "",
                });
        }
});

app.get(
        "/api/bus/:date/:startstation/:endstation/:starttimeleft/:starttimeright",
        async (req, res) => {
                try {
                        const buses = await searchBus({
                                date: req.params.date,
                                startStation: req.params.startstation,
                                endStation: req.params.endstation,
                                startTimeLeft: req.params.starttimeleft,
                                startTimeRight: req.params.starttimeright,
                        });
                        res.json({ StateCode: 1, Err: "", Buses: buses });
                } catch (error) {
                        const message =
                                error instanceof Error
                                        ? error.message
                                        : String(error);
                        console.error("[server][bus] error:", message, error);
                        res.json({ StateCode: -1, Err: message, Buses: [] });
                }
        }
);

app.listen(PORT, () => {
        console.log(`Node API listening on :${PORT}`);
});
