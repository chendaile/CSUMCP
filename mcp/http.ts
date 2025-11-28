import http from "node:http";
import express from "express";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { createMcpServer } from "./server.js";

const API_BASE_URL =
        process.env.API_BASE_URL || "http://127.0.0.1:12000";
const MCP_PORT = Number(process.env.MCP_PORT || "13000");

const sessions = new Map<
        string,
        {
                transport: SSEServerTransport;
                serverReturn: ReturnType<typeof createMcpServer>;
        }
>();

const app = express();

app.get("/", async (_req, res) => {
        const transport = new SSEServerTransport("/message", res);
        const server = createMcpServer({
                apiBaseUrl: API_BASE_URL,
                docBaseUrl: `http://localhost:${MCP_PORT}`,
        });
        sessions.set(transport.sessionId, { transport, serverReturn: server });

        transport.onclose = () => sessions.delete(transport.sessionId);
        transport.onerror = (err) =>
                console.error("[mcp-http] transport error", err);
        server.onerror = (err) => console.error("[mcp-http] server error", err);

        try {
                await server.connect(transport);
        } catch (error) {
                sessions.delete(transport.sessionId);
                console.error("[mcp-http] 会话建立失败:", error);
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
                console.error("[mcp-http] 处理消息失败:", error);
                if (!res.headersSent) {
                        res.status(500).end("post message failed");
                }
        }
});

http.createServer(app).listen(MCP_PORT, () => {
        console.log(
                `[mcp-http] MCP 服务已启动，端口 ${MCP_PORT}，代理 API ${API_BASE_URL}`
        );
});
