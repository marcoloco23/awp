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
  return matter.stringify(file.body, file.frontmatter);
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
