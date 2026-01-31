/**
 * CLI utility functions.
 *
 * Shared helpers for command implementations.
 */

import { findWorkspaceRoot } from "./workspace.js";

/**
 * Require that we're in an AWP workspace.
 * Exits with error code 1 if not found.
 *
 * @returns The workspace root path
 */
export async function requireWorkspaceRoot(): Promise<string> {
  const root = await findWorkspaceRoot();
  if (!root) {
    console.error("Error: Not in an AWP workspace. Run 'awp init' to create one.");
    process.exit(1);
  }
  return root;
}
