import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
        CallToolResultSchema,
        CallToolRequestSchema,
        GetPromptRequestSchema,
        ListPromptsRequestSchema,
        ListResourcesRequestSchema,
        ReadResourceRequestSchema,
        ReadResourceResultSchema,
        ListToolsRequestSchema,
        ToolSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

type ToolMeta = z.infer<typeof ToolSchema>;
type ToolResult = z.infer<typeof CallToolResultSchema>;

export interface CreateServerOptions {
        apiBaseUrl: string;
        docBaseUrl: string;
}

const defaultApiBaseUrl = process.env.API_BASE_URL || "http://127.0.0.1:12000";
const defaultDocBaseUrl =
        process.env.MCP_DOC_BASE ||
        `http://localhost:${process.env.MCP_PORT || "13000"}`;

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

const usageMarkdown = () => `# CSU MCP 使用手册
## 主要工具
- 成绩/排名/课表/等级考试/培养计划/辅修（csu.grade/rank/classes/level_exam/student_plan/minor_info）
- 学生信息 PDF（csu.student_info，base64）
- 成绩 Markdown 汇总（csu.summary，term 已隐藏，抓取全部）
- 图书馆电子资源/馆藏/复本/座位校区（csu.library_*）
- 校车查询（csu.bus，站点需从预设列表选择）

## 使用提示
- 异常会返回底层 API 错误；如认证失败请检查账号密码或教务可访问性,如果登入不进去可能是密码多次输入错误
`;

const usageResource = {
        uri: "res://csu-mcp/usage",
        name: "CSU MCP 使用手册",
        description: "说明连接方式、参数示例、各工具含义与注意事项。",
        mimeType: "text/markdown",
};

export const createMcpServer = (
        opts?: Partial<CreateServerOptions>
): Server => {
        const apiBaseUrl = opts?.apiBaseUrl ?? defaultApiBaseUrl;
        const docBaseUrl = opts?.docBaseUrl ?? defaultDocBaseUrl;

        const buildUrl = (path: string) => `${apiBaseUrl}${path}`;

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

        const toolDefs: {
                meta: ToolMeta;
                schema: z.ZodTypeAny;
                handler: (input: any) => Promise<ToolResult>;
        }[] = [];

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
                        const query = term
                                ? `?term=${encodeURIComponent(term)}`
                                : "";
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
                        description: "查询培养计划课程列表，需学号/密码。",
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
                        description: "查询辅修报名与缴费记录，需学号/密码。",
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
                                "生成成绩 Markdown 汇总，自动拉取全部学期，需学号/密码。",
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
                                `/api/jwc/${encodeURIComponent(
                                        id
                                )}/${encodeURIComponent(pwd)}/summary`
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
                                                description:
                                                        "电子资源名称关键词",
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
                                "查询图书馆复本/借阅信息，需学号/密码与 recordId（可以来自book_search）。",
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
                        description: "获取图书馆自习座位可用校区列表。",
                        inputSchema: {
                                type: "object",
                                properties: {},
                        },
                },
                schema: librarySeatCampusesSchema,
                handler: async () => {
                        const data = await fetchJSON(
                                `/api/library/seat/campuses`
                        );
                        return toJSONResult(data);
                },
        });

        const busSchema = z.object({
                date: z.string(),
                crs01: z.string(),
                crs02: z.string(),
        });
        const busStationOptions = [
                "中南大学潇湘校区(北3门)",
                "中南大学潇湘校区机电楼",
                "东塘",
                "潇湘校区艺术楼",
                "潇湘校区教学楼D座南坪",
                "升华学生公寓大门",
                "岳麓山校区图书馆前坪",
                "开福校区",
                "杏林校区",
                "杏林校区大门",
                "天心校区图书馆前坪",
                "天心校区办公楼前坪",
                "麓南校区一教学楼前坪",
                "科教新村",
        ];
        toolDefs.push({
                meta: {
                        name: "csu.bus",
                        description:
                                "查询校车班次，需日期与途径站点（如下所列），返回班次列表。",
                        inputSchema: {
                                type: "object",
                                properties: {
                                        date: {
                                                type: "string",
                                                description:
                                                        "出行日期，YYYY-MM-DD",
                                        },
                                        crs01: {
                                                type: "string",
                                                description:
                                                        "途径/上车站点，必须为预设站点之一",
                                                enum: busStationOptions,
                                        },
                                        crs02: {
                                                type: "string",
                                                description:
                                                        "途径/下车站点，必须为预设站点之一",
                                                enum: busStationOptions,
                                        },
                                },
                                required: ["date", "crs01", "crs02"],
                        },
                },
                schema: busSchema,
                handler: async ({ date, crs01, crs02 }) => {
                        const params = new URLSearchParams({
                                date,
                                crs01,
                                crs02,
                        });
                        const data = await fetchJSON(
                                `/api/bus?${params.toString()}`
                        );
                        return toJSONResult(data);
                },
        });

        const server = new Server(
                {
                        name: "csu-mcp",
                        version: "0.1.0",
                },
                {
                        capabilities: { tools: {}, resources: {}, prompts: {} },
                }
        );

        server.setRequestHandler(ListResourcesRequestSchema, async () => ({
                resources: [usageResource],
        }));

        server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
                if (request.params.uri !== usageResource.uri) {
                        throw new Error(`未知资源: ${request.params.uri}`);
                }
                return ReadResourceResultSchema.parse({
                        contents: [
                                {
                                        uri: usageResource.uri,
                                        mimeType: usageResource.mimeType,
                                        text: usageMarkdown(),
                                },
                        ],
                });
        });

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
                        throw new Error(`未知提示: ${request.params.name}`);
                }
                return {
                        messages: [
                                {
                                        role: "assistant",
                                        content: {
                                                type: "text",
                                                text: usageMarkdown(),
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
