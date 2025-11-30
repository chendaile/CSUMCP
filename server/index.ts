import express from "express";
import {
        classes,
        grade,
        rank,
        levelExam,
        studentInfo,
        minorInfo,
        studentPlan,
        summaryMarkdown,
} from "./jwc.js";
import {
        searchLibraryDb,
        searchLibraryBooks,
        fetchBookCopies,
        fetchSeatCampuses,
} from "./library.js";
import { searchBus } from "./bus.js";
import { logger } from "../logger.js";

const app = express();
const PORT = process.env.PORT || 12000;

const maskSensitive = (value?: string) => {
        if (!value) return "";
        if (value.length <= 2) return "***";
        return `${value.slice(0, 2)}***${value.slice(-1)}`;
};

const logDebug = (...args: unknown[]) => {
        logger.info("[server]", ...args);
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
                        "/api/jwc/:id/:pwd/grade?term=",
                        "/api/jwc/:id/:pwd/rank",
                        "/api/jwc/:id/:pwd/class/:term/:week",
                        "/api/jwc/:id/:pwd/levelexam",
                        "/api/jwc/:id/:pwd/studentinfo",
                        "/api/jwc/:id/:pwd/studentplan",
                        "/api/jwc/:id/:pwd/minorinfo",
                        "/api/jwc/:id/:pwd/summary",
                        "/api/library/dbsearch?elecName=",
                        "/api/library/:id/:pwd/booksearch?kw=",
                        "/api/library/:id/:pwd/bookcopies/:recordId",
                        "/api/library/seat/campuses",
                        "/api/bus?date=&crs01=&crs02=",
                ],
        });
});

app.get("/api/jwc/:id/:pwd/grade", async (req, res) => {
        try {
                const grades = await grade(
                        { id: req.params.id, pwd: req.params.pwd },
                        typeof req.query.term === "string" ? req.query.term : ""
                );
                res.json({ StateCode: 1, Error: "", Grades: grades });
        } catch (error) {
                const message =
                        error instanceof Error ? error.message : String(error);
                logger.error("[server][grade] error:", message, error);
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
                logger.error("[server][rank] error:", message, error);
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
                logger.error("[server][class] error:", message, error);
                res.json({
                        StateCode: -1,
                        Error: message,
                        Class: [],
                        StartWeekDay: "",
                });
        }
});

app.get("/api/jwc/:id/:pwd/levelexam", async (req, res) => {
        try {
                const exams = await levelExam({
                        id: req.params.id,
                        pwd: req.params.pwd,
                });
                res.json({ StateCode: 1, Error: "", LevelExams: exams });
        } catch (error) {
                const message =
                        error instanceof Error ? error.message : String(error);
                logger.error("[server][levelexam] error:", message, error);
                res.json({ StateCode: -1, Error: message, LevelExams: [] });
        }
});

app.get("/api/jwc/:id/:pwd/studentinfo", async (req, res) => {
        try {
                const file = await studentInfo({
                        id: req.params.id,
                        pwd: req.params.pwd,
                });
                res.setHeader("Content-Type", file.contentType);
                res.setHeader("Content-Disposition", file.contentDisposition);
                res.send(file.buffer);
        } catch (error) {
                const message =
                        error instanceof Error ? error.message : String(error);
                logger.error("[server][studentinfo] error:", message, error);
                res.status(500).json({ StateCode: -1, Error: message });
        }
});

app.get("/api/jwc/:id/:pwd/minorinfo", async (req, res) => {
        try {
                const data = await minorInfo({
                        id: req.params.id,
                        pwd: req.params.pwd,
                });
                res.json({
                        StateCode: 1,
                        Error: "",
                        Registrations: data.registrations,
                        Payments: data.payments,
                });
        } catch (error) {
                const message =
                        error instanceof Error ? error.message : String(error);
                logger.error("[server][minorinfo] error:", message, error);
                res.json({
                        StateCode: -1,
                        Error: message,
                        Registrations: [],
                        Payments: [],
                });
        }
});

app.get("/api/jwc/:id/:pwd/studentplan", async (req, res) => {
        try {
                const plans = await studentPlan({
                        id: req.params.id,
                        pwd: req.params.pwd,
                });
                res.json({ StateCode: 1, Error: "", Plan: plans });
        } catch (error) {
                const message =
                        error instanceof Error ? error.message : String(error);
                logger.error("[server][studentplan] error:", message, error);
                res.json({ StateCode: -1, Error: message, Plan: [] });
        }
});

app.get("/api/jwc/:id/:pwd/summary", async (req, res) => {
        try {
                const term = "";
                const md = await summaryMarkdown(
                        { id: req.params.id, pwd: req.params.pwd },
                        term
                );
                res.type("text/markdown").send(md);
        } catch (error) {
                const message =
                        error instanceof Error ? error.message : String(error);
                logger.error("[server][summary] error:", message, error);
                res.status(500).send(`# 获取失败\n\n- 错误: ${message}`);
        }
});

app.get("/api/bus", async (req, res) => {
        try {
                const getQ = (key: string): string => {
                        const v = req.query[key] as
                                | string
                                | string[]
                                | undefined;
                        if (Array.isArray(v)) return v[0] ?? "";
                        if (
                                v === "null" ||
                                v === "undefined" ||
                                v === undefined
                        )
                                return "";
                        return String(v);
                };
                const buses = await searchBus({
                        date: getQ("date"),
                        startStation: getQ("crs01"),
                        endStation: getQ("crs02"),
                        startTimeLeft: "",
                        startTimeRight: "",
                });
                res.json({ StateCode: 1, Err: "", Buses: buses });
        } catch (error) {
                const message =
                        error instanceof Error ? error.message : String(error);
                logger.error("[server][bus] error:", message, error);
                res.json({ StateCode: -1, Err: message, Buses: [] });
        }
});

app.get("/api/library/dbsearch", async (req, res) => {
        try {
                const elecName =
                        typeof req.query.elecName === "string"
                                ? req.query.elecName
                                : "";
                if (!elecName) {
                        return res.json({
                                StateCode: -1,
                                Error: "缺少 elecName 参数",
                                Data: { Chinese: [], Foreign: [] },
                        });
                }
                const data = await searchLibraryDb(elecName);
                res.json({ StateCode: 1, Error: "", Data: data });
        } catch (error) {
                const message =
                        error instanceof Error ? error.message : String(error);
                logger.error(
                        "[server][library dbsearch] error:",
                        message,
                        error
                );
                res.json({
                        StateCode: -1,
                        Error: message,
                        Data: { Chinese: [], Foreign: [] },
                });
        }
});

app.get("/api/library/:id/:pwd/booksearch", async (req, res) => {
        try {
                const kw = typeof req.query.kw === "string" ? req.query.kw : "";
                if (!kw) {
                        return res.json({
                                StateCode: -1,
                                Error: "缺少 kw 参数",
                                Data: "",
                        });
                }
                const data = await searchLibraryBooks(
                        { id: req.params.id, pwd: req.params.pwd },
                        kw
                );
                res.json({
                        StateCode: 1,
                        Error: "",
                        Status: data.status,
                        Data: (data.parsed || data.body),
                });
        } catch (error) {
                const message =
                        error instanceof Error ? error.message : String(error);
                logger.error(
                        "[server][library booksearch] error:",
                        message,
                        error
                );
                res.json({
                        StateCode: -1,
                        Error: message,
                        Status: 0,
                        Data: "",
                });
        }
});

app.get("/api/library/:id/:pwd/bookcopies/:recordId", async (req, res) => {
        try {
                const recordId = req.params.recordId;
                if (!recordId) {
                        return res.json({
                                StateCode: -1,
                                Error: "缺少 recordId 参数",
                                Data: "",
                        });
                }
                const data = await fetchBookCopies(
                        { id: req.params.id, pwd: req.params.pwd },
                        recordId
                );
                res.json({
                        StateCode: 1,
                        Error: "",
                        Status: data.status,
                        Data: data.parsed || data.body,
                });
        } catch (error) {
                const message =
                        error instanceof Error ? error.message : String(error);
                logger.error(
                        "[server][library bookcopies] error:",
                        message,
                        error
                );
                res.json({
                        StateCode: -1,
                        Error: message,
                        Status: 0,
                        Data: "",
                });
        }
});

app.get("/api/library/seat/campuses", async (_req, res) => {
        try {
                const data = await fetchSeatCampuses();
                res.json({
                        StateCode: 1,
                        Error: "",
                        Status: data.status,
                        Data: data.parsed || data.body,
                });
        } catch (error) {
                const message =
                        error instanceof Error ? error.message : String(error);
                logger.error(
                        "[server][library seat campuses] error:",
                        message,
                        error
                );
                res.json({
                        StateCode: -1,
                        Error: message,
                        Status: 0,
                        Data: "",
                });
        }
});

app.listen(PORT, () => {
        logger.info(`CSU API 已启动, 端口 :${PORT}`);
});
