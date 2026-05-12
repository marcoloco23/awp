import { readFile } from "node:fs/promises";
import matter from "gray-matter";
import type { BaseFrontmatter, WorkspaceFile } from "@agent-workspace/core";
import { atomicWriteFile } from "./safe-io.js";

/**
 * Parse an AWP workspace file (Markdown with YAML frontmatter).
 *
 * @template T - The frontmatter type
 * @param filePath - Path to the file
 * @returns Parsed workspace file
 */
export async function parseWorkspaceFile<T extends BaseFrontmatter>(
  filePath: string
): Promise<WorkspaceFile<T>> {
  const raw = await readFile(filePath, "utf-8");
  const { data, content } = matter(raw);
  return {
    frontmatter: data as T,
    body: content,
    filePath,
  };
}

/**
 * Serialize a workspace file back to Markdown with YAML frontmatter.
 *
 * @param file - The workspace file to serialize
 * @returns Serialized content string
 */
export function serializeWorkspaceFile<T extends BaseFrontmatter>(file: WorkspaceFile<T>): string {
  // js-yaml (used by gray-matter) throws on `undefined` values. Strip them
  // recursively so callers can pass through optional fields without guarding.
  const cleaned = stripUndefined(file.frontmatter) as unknown as Record<string, unknown>;
  return matter.stringify(file.body, cleaned);
}

/**
 * Recursively strip `undefined` values from an object/array, so it can be
 * safely YAML-dumped. js-yaml throws on `undefined`.
 */
export function stripUndefined(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripUndefined);
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined) continue;
      out[k] = stripUndefined(v);
    }
    return out;
  }
  return value;
}

/**
 * Write a workspace file to disk.
 *
 * @param file - The workspace file to write
 */
export async function writeWorkspaceFile<T extends BaseFrontmatter>(
  file: WorkspaceFile<T>
): Promise<void> {
  const content = serializeWorkspaceFile(file);
  await atomicWriteFile(file.filePath, content);
}

/**
 * Extract the type from frontmatter data.
 *
 * @param data - The frontmatter data
 * @returns The type string or undefined
 */
export function getFrontmatterType(data: Record<string, unknown>): string | undefined {
  return typeof data.type === "string" ? data.type : undefined;
}
