/**
 * Re-export frontmatter utilities from @agent-workspace/utils
 */
export {
  parseWorkspaceFile,
  serializeWorkspaceFile,
  writeWorkspaceFile,
  getFrontmatterType,
} from "@agent-workspace/utils";

/**
 * Check if a file has valid AWP frontmatter (has awp + type fields)
 */
export function hasAWPFrontmatter(data: Record<string, unknown>): boolean {
  return typeof data.awp === "string" && typeof data.type === "string";
}
