import matter from "gray-matter";
import { readFile, writeFile } from "node:fs/promises";
import type { BaseFrontmatter, WorkspaceFile } from "@awp/core";

/**
 * Parse a dual-format workspace file (YAML frontmatter + Markdown body)
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
 * Serialize a workspace file back to dual-format (YAML frontmatter + Markdown body)
 */
export function serializeWorkspaceFile<T extends BaseFrontmatter>(
  file: WorkspaceFile<T>
): string {
  return matter.stringify(file.body, file.frontmatter);
}

/**
 * Write a workspace file to disk
 */
export async function writeWorkspaceFile<T extends BaseFrontmatter>(
  file: WorkspaceFile<T>
): Promise<void> {
  const content = serializeWorkspaceFile(file);
  await writeFile(file.filePath, content, "utf-8");
}

/**
 * Check if a file has valid AWP frontmatter (has awp + type fields)
 */
export function hasAWPFrontmatter(data: Record<string, unknown>): boolean {
  return typeof data.awp === "string" && typeof data.type === "string";
}
