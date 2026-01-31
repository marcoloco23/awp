import { readFile, access, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { MANIFEST_PATH, type WorkspaceManifest } from "@agent-workspace/core";

/** Maximum file size allowed for safe reads (1MB) */
const MAX_FILE_SIZE = 1024 * 1024;

/**
 * Find workspace root by walking up from startDir looking for .awp/workspace.json.
 *
 * @param startDir - Directory to start searching from (defaults to cwd)
 * @returns The workspace root path, or null if not found
 */
export async function findWorkspaceRoot(startDir?: string): Promise<string | null> {
  let dir = resolve(startDir || process.cwd());
  const root = resolve("/");

  while (dir !== root) {
    const manifestPath = join(dir, MANIFEST_PATH);
    try {
      await access(manifestPath);
      return dir;
    } catch {
      dir = resolve(dir, "..");
    }
  }
  return null;
}

/**
 * Load workspace manifest from .awp/workspace.json.
 *
 * @param workspaceRoot - The workspace root directory
 * @returns The parsed workspace manifest
 * @throws Error if manifest cannot be read or parsed
 */
export async function loadManifest(workspaceRoot: string): Promise<WorkspaceManifest> {
  const manifestPath = join(workspaceRoot, MANIFEST_PATH);
  const raw = await readFile(manifestPath, "utf-8");
  return JSON.parse(raw) as WorkspaceManifest;
}

/**
 * Check if a file exists at the given path.
 *
 * @param path - The file path to check
 * @returns true if file exists, false otherwise
 */
export async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the agent DID from the workspace manifest, or "anonymous" if not set.
 *
 * @param workspaceRoot - The workspace root directory
 * @returns The agent DID or "anonymous"
 */
export async function getAgentDid(workspaceRoot: string): Promise<string> {
  try {
    const manifest = await loadManifest(workspaceRoot);
    return manifest.agent?.did || "anonymous";
  } catch {
    return "anonymous";
  }
}

/**
 * Read a file with size limit check to prevent memory issues.
 *
 * @param path - The file path to read
 * @param maxSize - Maximum allowed file size in bytes (default: 1MB)
 * @returns The file contents as a string
 * @throws Error if file is too large
 */
export async function safeReadFile(path: string, maxSize: number = MAX_FILE_SIZE): Promise<string> {
  const stats = await stat(path);
  if (stats.size > maxSize) {
    throw new Error(`File too large: ${stats.size} bytes (max: ${maxSize})`);
  }
  return readFile(path, "utf-8");
}

/**
 * Resolve workspace root from the AWP_WORKSPACE env var or cwd.
 * This is a simpler version that doesn't walk up directories.
 *
 * @returns The workspace root path
 */
export function getWorkspaceRoot(): string {
  return process.env.AWP_WORKSPACE || process.cwd();
}
