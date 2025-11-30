import fs from "node:fs";
import path from "node:path";

const logDir = path.resolve(process.cwd(), "log");
const logFile = path.join(logDir, "app.log");

fs.mkdirSync(logDir, { recursive: true });

const toText = (value: unknown): string => {
        if (typeof value === "string") return value;
        try {
                return JSON.stringify(value);
        } catch {
                return String(value);
        }
};

const write = (level: "INFO" | "ERROR", parts: unknown[]) => {
        const line = `${new Date().toISOString()} [${level}] ${parts
                .map(toText)
                .join(" ")}\n`;
        fs.appendFile(logFile, line, (err) => {
                if (err) {
                        // 最后兜底：日志写失败时输出到 stderr，避免静默丢失
                        process.stderr.write(
                                `log write failed: ${String(err)}\n`
                        );
                }
        });
};

export const logger = {
        info: (...parts: unknown[]) => write("INFO", parts),
        error: (...parts: unknown[]) => write("ERROR", parts),
};
