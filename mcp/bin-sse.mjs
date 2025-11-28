#!/usr/bin/env node
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const cliPath = fileURLToPath(new URL("./http.ts", import.meta.url));

const child = spawn(
        process.execPath,
        ["--import", "tsx/esm", cliPath, ...process.argv.slice(2)],
        {
                stdio: "inherit",
                env: process.env,
        }
);

child.on("exit", (code, signal) => {
        if (signal) {
                process.kill(process.pid, signal);
        } else {
                process.exit(code ?? 0);
        }
});
