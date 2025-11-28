import http from "node:http";
import express from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
        CallToolRequestSchema,
        CallToolResultSchema,
        GetPromptRequestSchema,
        ListPromptsRequestSchema,
        ListResourcesRequestSchema,
        ReadResourceRequestSchema,
        ListToolsRequestSchema,
        ReadResourceResultSchema,
        ResourceSchema,
        ToolSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

const API_BASE_URL = process.env.API_BASE_URL || "http://127.0.0.1:12000";
const MCP_PORT = Number(process.env.MCP_PORT || "13000");

type ToolMeta = z.infer<typeof ToolSchema>;
type ToolResult = z.infer<typeof CallToolResultSchema>;

type ToolDef<T extends z.ZodTypeAny> = {
        meta: ToolMeta;
        schema: T;
        handler: (input: z.infer<T>) => Promise<ToolResult>;
};

const toJSONResult = (data: unknown): ToolResult => ({
        content: [
                {
                        type: "text",
                        text: JSON.stringify(data, null, 2),
                },
        ],
});

const toTextResult = (text: string): ToolResult => ({
        content: [{ type: "text", text }],
});

const buildUrl = (path: string) => `${API_BASE_URL}${path}`;

const fetchJSON = async (path: string) => {
        const resp = await fetch(buildUrl(path));
        if (!resp.ok) {
                throw new Error(
                        `请求 ${path} 失败: ${resp.status} ${resp.statusText}`
                );
        }
        return resp.json();
};

const fetchText = async (path: string) => {
        const resp = await fetch(buildUrl(path));
        if (!resp.ok) {
                throw new Error(
                        `请求 ${path} 失败: ${resp.status} ${resp.statusText}`
                );
        }
        return resp.text();
};

const fetchBinary = async (path: string) => {
        const resp = await fetch(buildUrl(path));
        if (!resp.ok) {
                throw new Error(
                        `请求 ${path} 失败: ${resp.status} ${resp.statusText}`
                );
        }
        const arrayBuffer = await resp.arrayBuffer();
        return {
                base64: Buffer.from(arrayBuffer).toString("base64"),
                contentType: resp.headers.get("content-type") || "",
                contentDisposition:
                        resp.headers.get("content-disposition") || "",
        };
};

const credentialProps = {
        id: { type: "string", description: "学号" },
        pwd: { type: "string", description: "统一认证密码" },
} as const;

const toolDefs: ToolDef<any>[] = [];

const usageMarkdown = `# CSU MCP 使用手册

## 连接方式
- SSE MCP 入口：\${BASE}/
- 客户端会收到 endpoint 事件，然后改用 POST \${BASE}/message?sessionId=...
- 如需改端口/地址，设置环境变量 MCP_PORT / API_BASE_URL。

## 认证
- 需自备学号/统一认证密码；服务端不存储密码，仅转发至本机 API。

## 教务工具
- csu.grade：可选 term（如 2024-2025-1）；返回成绩列表。
- csu.rank：专业排名。
- csu.classes：term + week（0=全周）；返回按周几/节次的矩阵。
- csu.level_exam：等级考试成绩。
- csu.student_info：导出 PDF（base64）。
- csu.student_plan：培养计划课程。
- csu.minor_info：辅修报名与缴费。
- csu.summary：成绩 Markdown 汇总，固定拉取全部学期（term 已隐藏）。

## 图书馆工具
- csu.library_db_search：电子资源，参数 elecName。
- csu.library_book_search：馆藏检索（需学号/密码 + kw）。
- csu.library_book_copies：复本/借阅信息（recordId 来自搜索结果）。
- csu.library_seat_campuses：座位校区列表。

## 校车
- csu.bus：date, crs01(起点), crs02(终点)。

## 提示
- 失败时返回原始 API 错误；如遇认证问题，请确认账号/密码或教务系统可访问。`;

const usageResource = {
        uri: "res://csu-mcp/usage",
        name: "CSU MCP 使用手册",
        description: "说明连接方式、参数示例、各工具含义与注意事项。",
        mimeType: "text/markdown",
};

const gradeSchema = z.object({
        id: z.string(),
        pwd: z.string(),
        term: z.string().optional(),
});
toolDefs.push({
        meta: {
                name: "csu.grade",
                description:
                        "查询成绩列表，需学号/密码，可选 term（示例：2024-2025-1 / 2023-2024-2）。",
                inputSchema: {
                        type: "object",
                        properties: {
                                ...credentialProps,
                                term: {
                                        type: "string",
                                        description:
                                                "学年学期，可留空。示例：2024-2025-1、2023-2024-2",
                                        enum: [
                                                "2024-2025-1",
                                                "2023-2024-2",
                                                "2023-2024-1",
                                        ],
                                },
                        },
                        required: ["id", "pwd"],
                },
        },
        schema: gradeSchema,
        handler: async ({ id, pwd, term }) => {
                const query = term ? `?term=${encodeURIComponent(term)}` : "";
                const data = await fetchJSON(
                        `/api/jwc/${encodeURIComponent(
                                id
                        )}/${encodeURIComponent(pwd)}/grade${query}`
                );
                return toJSONResult(data);
        },
});

const rankSchema = z.object({
        id: z.string(),
        pwd: z.string(),
});
toolDefs.push({
        meta: {
                name: "csu.rank",
                description:
                        "查询专业排名，需学号/密码，返回各学期综合成绩与排名。",
                inputSchema: {
                        type: "object",
                        properties: { ...credentialProps },
                        required: ["id", "pwd"],
                },
        },
        schema: rankSchema,
        handler: async ({ id, pwd }) => {
                const data = await fetchJSON(
                        `/api/jwc/${encodeURIComponent(
                                id
                        )}/${encodeURIComponent(pwd)}/rank`
                );
                return toJSONResult(data);
        },
});

const classSchema = z.object({
        id: z.string(),
        pwd: z.string(),
        term: z.string(),
        week: z.string(),
});
toolDefs.push({
        meta: {
                name: "csu.classes",
                description:
                        "查询课表，需学号/密码 + term（形如 2024-2025-1）与 week（0=全周；1、2...=对应周次），返回按周几/节次排布的矩阵。",
                inputSchema: {
                        type: "object",
                        properties: {
                                ...credentialProps,
                                term: {
                                        type: "string",
                                        description:
                                                "学年学期，格式例如 2024-2025-1（教务系统同格式）",
                                },
                                week: {
                                        type: "string",
                                        description:
                                                "周次字符串：0 表示全部周次，'1' 表示第一周，以此类推",
                                },
                        },
                        required: ["id", "pwd", "term", "week"],
                },
        },
        schema: classSchema,
        handler: async ({ id, pwd, term, week }) => {
                const data = await fetchJSON(
                        `/api/jwc/${encodeURIComponent(
                                id
                        )}/${encodeURIComponent(
                                pwd
                        )}/class/${encodeURIComponent(
                                term
                        )}/${encodeURIComponent(week)}`
                );
                return toJSONResult(data);
        },
});

const levelExamSchema = z.object({
        id: z.string(),
        pwd: z.string(),
});
toolDefs.push({
        meta: {
                name: "csu.level_exam",
                description:
                        "查询等级考试成绩（如 CET、计算机等级等），需学号/密码。",
                inputSchema: {
                        type: "object",
                        properties: { ...credentialProps },
                        required: ["id", "pwd"],
                },
        },
        schema: levelExamSchema,
        handler: async ({ id, pwd }) => {
                const data = await fetchJSON(
                        `/api/jwc/${encodeURIComponent(
                                id
                        )}/${encodeURIComponent(pwd)}/levelexam`
                );
                return toJSONResult(data);
        },
});

const studentInfoSchema = z.object({
        id: z.string(),
        pwd: z.string(),
});
toolDefs.push({
        meta: {
                name: "csu.student_info",
                description:
                        "导出学生基本信息 PDF（base64 编码），需学号/密码。",
                inputSchema: {
                        type: "object",
                        properties: { ...credentialProps },
                        required: ["id", "pwd"],
                },
        },
        schema: studentInfoSchema,
        handler: async ({ id, pwd }) => {
                const data = await fetchBinary(
                        `/api/jwc/${encodeURIComponent(
                                id
                        )}/${encodeURIComponent(pwd)}/studentinfo`
                );
                return toJSONResult(data);
        },
});

const studentPlanSchema = z.object({
        id: z.string(),
        pwd: z.string(),
});
toolDefs.push({
        meta: {
                name: "csu.student_plan",
                description:
                        "查询培养计划课程列表，需学号/密码。",
                inputSchema: {
                        type: "object",
                        properties: { ...credentialProps },
                        required: ["id", "pwd"],
                },
        },
        schema: studentPlanSchema,
        handler: async ({ id, pwd }) => {
                const data = await fetchJSON(
                        `/api/jwc/${encodeURIComponent(
                                id
                        )}/${encodeURIComponent(pwd)}/studentplan`
                );
                return toJSONResult(data);
        },
});

const minorInfoSchema = z.object({
        id: z.string(),
        pwd: z.string(),
});
toolDefs.push({
        meta: {
                name: "csu.minor_info",
                description:
                        "查询辅修报名与缴费记录，需学号/密码。",
                inputSchema: {
                        type: "object",
                        properties: { ...credentialProps },
                        required: ["id", "pwd"],
                },
        },
        schema: minorInfoSchema,
        handler: async ({ id, pwd }) => {
                const data = await fetchJSON(
                        `/api/jwc/${encodeURIComponent(
                                id
                        )}/${encodeURIComponent(pwd)}/minorinfo`
                );
                return toJSONResult(data);
        },
});

const summarySchema = z.object({
        id: z.string(),
        pwd: z.string(),
});
toolDefs.push({
        meta: {
                name: "csu.summary",
                description:
                        "生成成绩 Markdown 汇总，自动拉取全部学期（term 已隐藏），需学号/密码。",
                inputSchema: {
                        type: "object",
                        properties: {
                                ...credentialProps,
                        },
                        required: ["id", "pwd"],
                },
        },
        schema: summarySchema,
        handler: async ({ id, pwd }) => {
                const data = await fetchText(
                        `/api/jwc/${encodeURIComponent(id)}/${encodeURIComponent(
                                pwd
                        )}/summary`
                );
                return toTextResult(data);
        },
});

const libraryDbSearchSchema = z.object({
        elecName: z.string(),
});
toolDefs.push({
        meta: {
                name: "csu.library_db_search",
                description:
                        "图书馆电子资源检索，传 elecName 关键词，返回中外文库列表。",
                inputSchema: {
                        type: "object",
                        properties: {
                                elecName: {
                                        type: "string",
                                        description: "电子资源名称关键词",
                                },
                        },
                        required: ["elecName"],
                },
        },
        schema: libraryDbSearchSchema,
        handler: async ({ elecName }) => {
                const data = await fetchJSON(
                        `/api/library/dbsearch?elecName=${encodeURIComponent(
                                elecName
                        )}`
                );
                return toJSONResult(data);
        },
});

const libraryBookSearchSchema = z.object({
        id: z.string(),
        pwd: z.string(),
        kw: z.string(),
});
toolDefs.push({
        meta: {
                name: "csu.library_book_search",
                description:
                        "图书馆馆藏检索，需学号/密码与关键词 kw，返回搜索结果和状态。",
                inputSchema: {
                        type: "object",
                        properties: {
                                ...credentialProps,
                                kw: {
                                        type: "string",
                                        description: "检索关键词",
                                },
                        },
                        required: ["id", "pwd", "kw"],
                },
        },
        schema: libraryBookSearchSchema,
        handler: async ({ id, pwd, kw }) => {
                const data = await fetchJSON(
                        `/api/library/${encodeURIComponent(
                                id
                        )}/${encodeURIComponent(
                                pwd
                        )}/booksearch?kw=${encodeURIComponent(kw)}`
                );
                return toJSONResult(data);
        },
});

const libraryBookCopiesSchema = z.object({
        id: z.string(),
        pwd: z.string(),
        recordId: z.string(),
});
toolDefs.push({
        meta: {
                name: "csu.library_book_copies",
                description:
                        "查询图书馆复本/借阅信息，需学号/密码与 recordId（来自搜索结果）。",
                inputSchema: {
                        type: "object",
                        properties: {
                                ...credentialProps,
                                recordId: {
                                        type: "string",
                                        description: "记录 ID",
                                },
                        },
                        required: ["id", "pwd", "recordId"],
                },
        },
        schema: libraryBookCopiesSchema,
        handler: async ({ id, pwd, recordId }) => {
                const data = await fetchJSON(
                        `/api/library/${encodeURIComponent(
                                id
                        )}/${encodeURIComponent(
                                pwd
                        )}/bookcopies/${encodeURIComponent(recordId)}`
                );
                return toJSONResult(data);
        },
});

const librarySeatCampusesSchema = z.object({});
toolDefs.push({
        meta: {
                name: "csu.library_seat_campuses",
                description:
                        "获取图书馆自习座位可用校区列表。",
                inputSchema: {
                        type: "object",
                        properties: {},
                },
        },
        schema: librarySeatCampusesSchema,
        handler: async () => {
                const data = await fetchJSON(`/api/library/seat/campuses`);
                return toJSONResult(data);
        },
});

const busSchema = z.object({
        date: z.string(),
        crs01: z.string(),
        crs02: z.string(),
});
toolDefs.push({
        meta: {
                name: "csu.bus",
                description:
                        "查询校车班次，需日期与起终点站，返回班次列表。",
                inputSchema: {
                        type: "object",
                        properties: {
                                date: {
                                        type: "string",
                                        description: "出行日期，YYYY-MM-DD",
                                },
                                crs01: {
                                        type: "string",
                                        description: "途径/上车站点",
                                },
                                crs02: {
                                        type: "string",
                                        description: "途径/下车站点",
                                },
                        },
                        required: ["date", "crs01", "crs02"],
                },
        },
        schema: busSchema,
        handler: async ({ date, crs01, crs02 }) => {
                const params = new URLSearchParams({ date, crs01, crs02 });
                const data = await fetchJSON(`/api/bus?${params.toString()}`);
                return toJSONResult(data);
        },
});

const createMcpServer = () => {
        const server = new Server(
                {
                        name: "csu-mcp",
                        version: "0.1.0",
                },
                {
                        capabilities: { tools: {}, resources: {}, prompts: {} },
                }
        );

        server.setRequestHandler(
                ListResourcesRequestSchema,
                async () => ({
                        resources: [usageResource],
                })
        );

        server.setRequestHandler(
                ReadResourceRequestSchema,
                async (request) => {
                        if (request.params.uri !== usageResource.uri) {
                                throw new Error(
                                        `未知资源: ${request.params.uri}`
                                );
                        }
                        return ReadResourceResultSchema.parse({
                                contents: [
                                        {
                                                uri: usageResource.uri,
                                                mimeType:
                                                        usageResource.mimeType,
                                                text: usageMarkdown.replace(
                                                        /\$\{BASE\}/g,
                                                        `http://localhost:${MCP_PORT}`
                                                ),
                                        },
                                ],
                        });
                }
        );

        server.setRequestHandler(ListPromptsRequestSchema, async () => ({
                prompts: [
                        {
                                name: "csu-mcp-usage",
                                description:
                                        "CSU MCP 使用手册（工具/参数示例）",
                        },
                ],
        }));

        server.setRequestHandler(GetPromptRequestSchema, async (request) => {
                if (request.params.name !== "csu-mcp-usage") {
                        throw new Error(
                                `未知提示: ${request.params.name}`
                        );
                }
                return {
                        messages: [
                                {
                                        role: "assistant",
                                        content: {
                                                type: "text",
                                                text: usageMarkdown.replace(
                                                        /\$\{BASE\}/g,
                                                        `http://localhost:${MCP_PORT}`
                                                ),
                                        },
                                },
                        ],
                };
        });

        server.setRequestHandler(ListToolsRequestSchema, async () => ({
                tools: toolDefs.map((t) => t.meta),
        }));

        server.setRequestHandler(CallToolRequestSchema, async (request) => {
                const found = toolDefs.find(
                        (t) => t.meta.name === request.params.name
                );
                if (!found) {
                        throw new Error(`未知工具: ${request.params.name}`);
                }
                const parsed = found.schema.parse(
                        request.params.arguments ?? {}
                );
                return found.handler(parsed);
        });

        return server;
};

const sessions = new Map<
        string,
        {
                transport: SSEServerTransport;
                server: ReturnType<typeof createMcpServer>;
        }
>();

const app = express();

app.get("/", async (_req, res) => {
        const transport = new SSEServerTransport("/message", res);
        const server = createMcpServer();
        sessions.set(transport.sessionId, { transport, server });

        transport.onclose = () => sessions.delete(transport.sessionId);
        transport.onerror = (err) =>
                console.error("[mcp] transport error", err);
        server.onerror = (err) => console.error("[mcp] server error", err);

        try {
                await server.connect(transport);
        } catch (error) {
                sessions.delete(transport.sessionId);
                console.error("[mcp] 会话建立失败:", error);
                if (!res.headersSent) {
                        res.status(500).end("MCP 连接失败");
                }
        }
});

app.post("/message", async (req, res) => {
        const sessionId =
                typeof req.query.sessionId === "string"
                        ? req.query.sessionId
                        : "";
        const entry = sessionId ? sessions.get(sessionId) : undefined;
        if (!entry) {
                res.status(404).end("session not found");
                return;
        }
        try {
                await entry.transport.handlePostMessage(req, res);
        } catch (error) {
                console.error("[mcp] 处理消息失败:", error);
                if (!res.headersSent) {
                        res.status(500).end("post message failed");
                }
        }
});

http.createServer(app).listen(MCP_PORT, () => {
        console.log(
                `[mcp] MCP 服务已启动，端口 ${MCP_PORT}，代理 API ${API_BASE_URL}`
        );
});
