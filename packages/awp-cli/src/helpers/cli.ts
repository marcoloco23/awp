import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Absolute path to the built CLI entrypoint (dist/index.js). */
export const CLI_PATH = resolve(__dirname, "..", "..", "dist", "index.js");

export interface CliResult {
  code: number;
  stdout: string;
  stderr: string;
}

/**
 * Run the built awp CLI with the given args.
 * @param args - argv to pass after `awp`
 * @param cwd - working directory for the spawned process
 * @param env - extra environment variables
 */
export function runCli(
  args: string[],
  cwd: string,
  env: Record<string, string> = {},
): Promise<CliResult> {
  return new Promise((resolvePromise) => {
    const child = spawn("node", [CLI_PATH, ...args], {
      cwd,
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (b) => (stdout += b.toString()));
    child.stderr.on("data", (b) => (stderr += b.toString()));
    child.on("close", (code) => {
      resolvePromise({ code: code ?? -1, stdout, stderr });
    });
  });
}
