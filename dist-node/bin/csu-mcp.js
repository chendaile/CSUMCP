#!/usr/bin/env node
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const apiPort = process.env.PORT || "12000";
const apiBase = `http://127.0.0.1:${apiPort}`;
const serverEntry = join(__dirname, "..", "server", "index.js");
const stdioEntry = join(__dirname, "..", "mcp", "stdio.js");
const children = [];
const spawnProc = (cmd, args, extraEnv = {}) => {
    const child = spawn(cmd, args, {
        stdio: "inherit",
        env: { ...process.env, ...extraEnv },
    });
    children.push(child);
    child.on("exit", (code, signal) => {
        if (signal) {
            process.kill(process.pid, signal);
        }
        else if (code && code !== 0) {
            process.exit(code);
        }
    });
};
spawnProc(process.execPath, [serverEntry], { PORT: apiPort });
spawnProc(process.execPath, [stdioEntry], { API_BASE_URL: apiBase });
const cleanup = () => {
    for (const c of children) {
        c.kill();
    }
};
process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
