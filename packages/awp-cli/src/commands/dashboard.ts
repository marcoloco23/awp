import { spawn } from "node:child_process";
import { resolve, dirname } from "node:path";
import { createRequire } from "node:module";
import { requireWorkspaceRoot } from "../lib/cli-utils.js";

/**
 * Locate the awp-dashboard package directory by resolving its package.json.
 */
function findDashboardDir(): string | null {
  try {
    const require = createRequire(import.meta.url);
    const pkgPath = require.resolve("@agent-workspace/dashboard/package.json");
    return dirname(pkgPath);
  } catch {
    return null;
  }
}

/**
 * awp dashboard — launch the governance dashboard
 */
export async function dashboardCommand(opts: { port?: string; workspace?: string }): Promise<void> {
  const port = opts.port || "3000";

  // Resolve workspace root
  let workspace: string;
  if (opts.workspace) {
    workspace = resolve(opts.workspace);
  } else {
    workspace = await requireWorkspaceRoot();
  }

  // Find dashboard package
  const dashboardDir = findDashboardDir();
  if (!dashboardDir) {
    console.error("Could not find @agent-workspace/dashboard package.");
    console.error("Make sure it is installed in your project.");
    process.exit(1);
  }

  console.log(`Starting AWP Dashboard...`);
  console.log(`  Workspace: ${workspace}`);
  console.log(`  Dashboard: ${dashboardDir}`);
  console.log(`  Port:      ${port}`);
  console.log();
  console.log(`  http://localhost:${port}`);
  console.log();

  const child = spawn("npx", ["next", "dev", "--port", port], {
    cwd: dashboardDir,
    env: {
      ...process.env,
      AWP_WORKSPACE: workspace,
      PORT: port,
    },
    stdio: "inherit",
    shell: true,
  });

  child.on("error", (err) => {
    console.error(`Failed to start dashboard: ${err.message}`);
    process.exit(1);
  });

  child.on("exit", (code) => {
    process.exit(code ?? 0);
  });

  // Handle Ctrl+C gracefully
  process.on("SIGINT", () => {
    child.kill("SIGINT");
  });

  process.on("SIGTERM", () => {
    child.kill("SIGTERM");
  });
}
