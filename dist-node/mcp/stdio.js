import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer } from "./server.js";
import { logger } from "../logger.js";
const API_BASE_URL = process.env.API_BASE_URL || "http://127.0.0.1:12000";
const server = createMcpServer({
    apiBaseUrl: API_BASE_URL,
    docBaseUrl: "stdio://local",
});
server
    .connect(new StdioServerTransport())
    .catch((err) => {
    logger.error("[mcp-stdio] 启动失败:", err);
    process.exit(1);
})
    .then(() => {
    logger.info("[mcp-stdio] 已启动（stdio 模式）");
});
