import express from "express";
import { classes, grade, rank, levelExam, studentInfo, minorInfo, studentPlan, } from "./jwc.js";
import { searchLibraryDb, searchLibraryBooks, fetchSeatCampuses, } from "./library.js";
import { fetchCardInfo, fetchCardTurnover } from "./ecard.js";
import { searchBus } from "./bus.js";
import { logger } from "../logger.js";
const app = express();
const PORT = process.env.PORT || 12000;
const ROUTES = [
    "/api/jwc/:id/:pwd/grade?term=",
    "/api/jwc/:id/:pwd/rank",
    "/api/jwc/:id/:pwd/class/:term/:week",
    "/api/jwc/:id/:pwd/levelexam",
    "/api/jwc/:id/:pwd/studentinfo",
    "/api/jwc/:id/:pwd/studentplan",
    "/api/jwc/:id/:pwd/minorinfo",
    "/api/library/dbsearch?elecName=",
    "/api/library/booksearch?kw=",
    "/api/library/seat/campuses",
    "/api/ecard/:id/:pwd/card",
    "/api/ecard/:id/:pwd/turnover?timeFrom=&timeTo=&amountFrom=&amountTo=",
    "/api/bus?date=&crs01=&crs02=",
];
const maskSensitive = (value) => {
    if (!value)
        return "";
    if (value.length <= 2)
        return "***";
    return `${value.slice(0, 2)}***${value.slice(-1)}`;
};
const logDebug = (...args) => {
    logger.info("[server]", ...args);
};
const resolveCredential = (req) => {
    const envId = process.env.CSU_ID?.trim();
    const envPwd = process.env.CSU_PWD?.trim();
    return {
        id: envId && envId.length > 0 ? envId : req.params.id,
        pwd: envPwd && envPwd.length > 0 ? envPwd : req.params.pwd,
    };
};
app.use((req, res, next) => {
    const startedAt = Date.now();
    const maskedParams = { ...req.params };
    if ("pwd" in maskedParams) {
        const cred = resolveCredential(req);
        maskedParams.pwd = maskSensitive(cred.pwd);
    }
    logDebug("incoming", req.method, req.originalUrl, {
        query: req.query,
        params: maskedParams,
    });
    res.on("finish", () => {
        logDebug("completed", req.method, req.originalUrl, "status:", res.statusCode, "duration:", `${Date.now() - startedAt}ms`);
    });
    next();
});
const handleEcardTurnover = async (req, res) => {
    try {
        const user = resolveCredential(req);
        const params = req.method === "POST" ? req.body || {} : req.query;
        const asOptionalString = (v) => typeof v === "string" && v.trim() !== ""
            ? v.trim()
            : undefined;
        const timeFrom = asOptionalString(params.timeFrom);
        const timeTo = asOptionalString(params.timeTo);
        const amountFrom = asOptionalString(params.amountFrom);
        const amountTo = asOptionalString(params.amountTo);
        const data = await fetchCardTurnover(user.id, user.pwd, {
            timeFrom: timeFrom ?? "",
            timeTo: timeTo ?? "",
            amountFrom: amountFrom !== undefined
                ? Number(amountFrom)
                : undefined,
            amountTo: amountTo !== undefined
                ? Number(amountTo)
                : undefined,
            size: 10,
            current: 1,
        });
        res.json({
            StateCode: 1,
            Error: "",
            Status: data.status,
            Data: data.simplified ?? data.parsed ?? data.body,
            FinalUrl: data.finalUrl || "",
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error("[server][ecard turnover] error:", message, error);
        res.json({ StateCode: -1, Error: message, Data: null });
    }
};
app.get("/", (_req, res) => {
    res.json({
        service: "CSU MCP",
        routes: ROUTES,
    });
});
app.get("/api/meta", (_req, res) => {
    res.json({
        service: "CSU MCP",
        routes: ROUTES,
    });
});
app.get("/api/jwc/:id/:pwd/grade", async (req, res) => {
    try {
        const user = resolveCredential(req);
        const grades = await grade(user, typeof req.query.term === "string" ? req.query.term : "");
        res.json({ StateCode: 1, Error: "", Grades: grades });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error("[server][grade] error:", message, error);
        res.json({ StateCode: -1, Error: message, Grades: [] });
    }
});
app.get("/api/jwc/:id/:pwd/rank", async (req, res) => {
    try {
        const user = resolveCredential(req);
        const ranks = await rank(user);
        res.json({ StateCode: 1, Error: "", Rank: ranks });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error("[server][rank] error:", message, error);
        res.json({ StateCode: -1, Error: message, Rank: [] });
    }
});
app.get("/api/jwc/:id/:pwd/class/:term/:week", async (req, res) => {
    try {
        const user = resolveCredential(req);
        const { classes: cls, startWeekDay } = await classes(user, req.params.term, req.params.week);
        res.json({
            StateCode: 1,
            Error: "",
            Class: cls,
            StartWeekDay: startWeekDay,
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
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
        const user = resolveCredential(req);
        const exams = await levelExam(user);
        res.json({ StateCode: 1, Error: "", LevelExams: exams });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error("[server][levelexam] error:", message, error);
        res.json({ StateCode: -1, Error: message, LevelExams: [] });
    }
});
app.get("/api/jwc/:id/:pwd/studentinfo", async (req, res) => {
    try {
        const user = resolveCredential(req);
        const data = await studentInfo(user);
        res.json({ StateCode: 1, Error: "", Data: data });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error("[server][studentinfo] error:", message, error);
        res.json({ StateCode: -1, Error: message, Data: null });
    }
});
app.get("/api/jwc/:id/:pwd/minorinfo", async (req, res) => {
    try {
        const user = resolveCredential(req);
        const data = await minorInfo(user);
        res.json({
            StateCode: 1,
            Error: "",
            Registrations: data.registrations,
            Payments: data.payments,
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
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
        const user = resolveCredential(req);
        const plans = await studentPlan(user);
        res.json({ StateCode: 1, Error: "", Plan: plans });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error("[server][studentplan] error:", message, error);
        res.json({ StateCode: -1, Error: message, Plan: [] });
    }
});
app.get("/api/bus", async (req, res) => {
    try {
        const dateParam = typeof req.query.date === "string" ? req.query.date : "";
        const getQ = (key) => {
            const v = req.query[key];
            if (Array.isArray(v))
                return v[0] ?? "";
            if (v === "null" ||
                v === "undefined" ||
                v === undefined)
                return "";
            return String(v);
        };
        const buses = await searchBus({
            date: dateParam,
            startStation: getQ("crs01"),
            endStation: getQ("crs02"),
            startTimeLeft: "",
            startTimeRight: "",
        });
        res.json({ StateCode: 1, Err: "", Buses: buses });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error("[server][bus] error:", message, error);
        res.json({ StateCode: -1, Err: message, Buses: [] });
    }
});
app.get("/api/library/dbsearch", async (req, res) => {
    try {
        const elecName = typeof req.query.elecName === "string"
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
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error("[server][library dbsearch] error:", message, error);
        res.json({
            StateCode: -1,
            Error: message,
            Data: { Chinese: [], Foreign: [] },
        });
    }
});
app.get("/api/library/booksearch", async (req, res) => {
    try {
        const kw = typeof req.query.kw === "string" ? req.query.kw : "";
        if (!kw) {
            return res.json({
                StateCode: -1,
                Error: "缺少 kw 参数",
                Data: "",
            });
        }
        const data = await searchLibraryBooks({ id: "", pwd: "" }, kw);
        const dataPayload = data.parsed
            ? data.parsed
            : { raw: data.body, url: data.url ?? "" };
        res.json({
            StateCode: 1,
            Error: "",
            Status: data.status,
            Data: dataPayload,
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error("[server][library booksearch] error:", message, error);
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
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error("[server][library seat campuses] error:", message, error);
        res.json({
            StateCode: -1,
            Error: message,
            Status: 0,
            Data: "",
        });
    }
});
app.get("/api/ecard/:id/:pwd/card", async (req, res) => {
    try {
        const user = resolveCredential(req);
        const data = await fetchCardInfo(user.id, user.pwd);
        const payload = data.simplified ?? data.parsed ?? data.body;
        res.json({
            StateCode: 1,
            Error: "",
            Status: data.status,
            Data: payload,
            FinalUrl: data.finalUrl || "",
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error("[server][ecard card] error:", message, error);
        res.json({ StateCode: -1, Error: message, Data: null });
    }
});
app.post("/api/ecard/:id/:pwd/turnover", async (req, res) => {
    await handleEcardTurnover(req, res);
});
app.get("/api/ecard/:id/:pwd/turnover", async (req, res) => {
    await handleEcardTurnover(req, res);
});
app.listen(PORT, () => {
    logger.info(`CSU API 已启动, 端口 :${PORT}`);
});
