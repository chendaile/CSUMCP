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

const usageMarkdown = () => {
        return [
                "# CSU MCP 使用手册",
                "你是一个会使用 CSUMCP 的中南大学学生的数据查询分析者。",
                "",
                "## 常见需求和操作指引",
                "1. **制作简历**：依次调用 csu.student_plan、csu.minor_info、csu.rank、csu.level_exam、csu.grade；需要用户提供学号和密码。",
                "2. **预约图书馆座位**：调用 csu.library_seat_campuses，返回各校区/楼层剩余座位和对应预约 URL，供用户自行预约。",
                "3. **查看校园卡收支流水**：调用 csu.ecard_turnover、csu.ecard_card；需要用户提供学号和密码，返回流水与校园卡基本信息。",
                "4. **查看校园摆渡车/规划出行**：",
                "   - 先列出可选站点让用户选择：",
                '     "中南大学潇湘校区(北3门)", "中南大学潇湘校区机电楼", "东塘", "潇湘校区艺术楼", "潇湘校区教学楼D座南坪",',
                '     "升华学生公寓大门", "岳麓山校区图书馆前坪", "开福校区", "杏林校区", "杏林校区大门",',
                '     "天心校区图书馆前坪", "天心校区办公楼前坪", "麓南校区一教学楼前坪", "科教新村"',
                "   - 询问出发地/目的地和查询日期（可用 get_current_time 获取今天日期）。",
                "   - 调用 csu.bus 获取班次；可结合高德地图 MCP 给出起终点行程信息。",
                "5. **查看课表信息**：",
                "   - 调用 csu.classes，需学号密码，询问学期与周次；如需与当前日期相关可用 get_current_time。",
                "   - 注意：返回的 TimeInWeek 减 1 即为一周中的第几天，例如 TimeInWeek=2 表示周一。",
                "   - 2025-2026-1 学期周次参考：",
                "     第1周 2025-09-08日至2025-09-13日；第2周 2025-09-14日至2025-09-20日；",
                "     第3周 2025-09-21日至2025-09-27日；第4周 2025-09-28日至2025-10-04日；",
                "     第5周 2025-10-05日至2025-10-11日；第6周 2025-10-12日至2025-10-18日；",
                "     第7周 2025-10-19日至2025-10-25日；第8周 2025-10-26日至2025-11-01日；",
                "     第9周 2025-11-02日至2025-11-08日；第10周 2025-11-09日至2025-11-15日；",
                "     第11周 2025-11-16日至2025-11-22日；第12周 2025-11-23日至2025-11-29日；",
                "     第13周 2025-11-30日至2025-12-06日；第14周 2025-12-07日至2025-12-13日；",
                "     第15周 2025-12-14日至2025-12-20日；第16周 2025-12-21日至2025-12-27日；",
                "     第17周 2025-12-28日至2026-01-03日；第18周 2026-01-04日至2026-01-10日；",
                "     第19周 2026-01-11日至2026-01-17日；第20周 2026-01-18日至2026-01-24日；",
                "     第21周 2026-01-25日至2026-01-31日；第22周 2026-02-01日至2026-02-07日。",
                "6. **查询图书馆图书**：调用 csu.library_book_search 查询书籍信息，或 csu.library_db_search 查询学校数据库。",
        ].join("\n");
};

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
                                "查询成绩列表，需学号/密码，可选 term（示例：2024-2025-1 / 2023-2024-2）,否则为全部学期数据。",
                        inputSchema: {
                                type: "object",
                                properties: {
                                        ...credentialProps,
                                        term: {
                                                type: "string",
                                                description:
                                                        "学年学期,（格式如 2025-2026-1、2024-2025-2 等）,可留空(代表全部学期)",
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
                kw: z.string(),
        });
        toolDefs.push({
                meta: {
                        name: "csu.library_book_search",
                        description:
                                "图书馆馆藏检索，仅需关键词 kw，返回搜索结果和状态。",
                        inputSchema: {
                                type: "object",
                                properties: {
                                        kw: {
                                                type: "string",
                                                description: "检索关键词",
                                        },
                                },
                                required: ["kw"],
                        },
                },
                schema: libraryBookSearchSchema,
                handler: async ({ kw }) => {
                        const data = await fetchJSON(
                                `/api/library/booksearch?kw=${encodeURIComponent(
                                        kw
                                )}`
                        );
                        return toJSONResult(data);
                },
        });

        const librarySeatCampusesSchema = z.object({});
        toolDefs.push({
                meta: {
                        name: "csu.library_seat_campuses",
                        description: "获取不同校区图书馆自习座位情况。",
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

        const ecardCardSchema = z.object({
                id: z.string(),
                pwd: z.string(),
        });
        toolDefs.push({
                meta: {
                        name: "csu.ecard_card",
                        description: "校园卡基础信息查询，需学号/密码。",
                        inputSchema: {
                                type: "object",
                                properties: { ...credentialProps },
                                required: ["id", "pwd"],
                        },
                },
                schema: ecardCardSchema,
                handler: async ({ id, pwd }) => {
                        const data = await fetchJSON(
                                `/api/ecard/${encodeURIComponent(
                                        id
                                )}/${encodeURIComponent(pwd)}/card`
                        );
                        return toJSONResult(data);
                },
        });

        const ecardTurnoverSchema = z.object({
                id: z.string(),
                pwd: z.string(),
                timeFrom: z.string().optional(),
                timeTo: z.string().optional(),
                amountFrom: z.string().optional(),
                amountTo: z.string().optional(),
        });
        toolDefs.push({
                meta: {
                        name: "csu.ecard_turnover",
                        description:
                                "校园卡流水查询，timeFrom/timeTo/amountFrom/amountTo 可选",
                        inputSchema: {
                                type: "object",
                                properties: {
                                        ...credentialProps,
                                        timeFrom: {
                                                type: "string",
                                                description:
                                                        "起始日期 YYYY-MM-DD，可留空",
                                        },
                                        timeTo: {
                                                type: "string",
                                                description:
                                                        "结束日期 YYYY-MM-DD，可留空",
                                        },
                                        amountFrom: {
                                                type: "string",
                                                description: "金额下限，可留空",
                                        },
                                        amountTo: {
                                                type: "string",
                                                description: "金额上限，可留空",
                                        },
                                },
                                required: ["id", "pwd"],
                        },
                },
                schema: ecardTurnoverSchema,
                handler: async ({
                        id,
                        pwd,
                        timeFrom,
                        timeTo,
                        amountFrom,
                        amountTo,
                }) => {
                        const qs = new URLSearchParams();
                        if (timeFrom) qs.set("timeFrom", timeFrom);
                        if (timeTo) qs.set("timeTo", timeTo);
                        if (amountFrom) qs.set("amountFrom", amountFrom);
                        if (amountTo) qs.set("amountTo", amountTo);
                        const query = qs.toString() ? `?${qs.toString()}` : "";
                        const data = await fetchJSON(
                                `/api/ecard/${encodeURIComponent(
                                        id
                                )}/${encodeURIComponent(pwd)}/turnover${query}`
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
