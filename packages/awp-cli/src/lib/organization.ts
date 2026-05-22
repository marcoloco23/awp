import { readdir, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { ORGANIZATIONS_DIR } from "@agent-workspace/core";
import type { OrganizationFrontmatter, WorkspaceFile } from "@agent-workspace/core";
import { parseWorkspaceFile } from "./frontmatter.js";

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

/** Validate an organization slug. */
export function validateSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug);
}

/** Get the file path for an organization slug. */
export function slugToOrgPath(workspaceRoot: string, slug: string): string {
  return join(workspaceRoot, ORGANIZATIONS_DIR, `${slug}.md`);
}

/** Extract the slug from an org:<slug> ID. */
export function orgIdToSlug(id: string): string {
  return id.replace(/^org:/, "");
}

/** Load an organization by slug. */
export async function loadOrganization(
  workspaceRoot: string,
  slug: string,
): Promise<WorkspaceFile<OrganizationFrontmatter>> {
  const filePath = slugToOrgPath(workspaceRoot, slug);
  return parseWorkspaceFile<OrganizationFrontmatter>(filePath);
}

/** List all organizations in the workspace. */
export async function listOrganizations(
  workspaceRoot: string,
): Promise<WorkspaceFile<OrganizationFrontmatter>[]> {
  const orgsDir = join(workspaceRoot, ORGANIZATIONS_DIR);
  let entries: string[];
  try {
    entries = await readdir(orgsDir);
  } catch {
    return [];
  }

  const mdFiles = entries.filter((f) => f.endsWith(".md")).sort();
  const orgs: WorkspaceFile<OrganizationFrontmatter>[] = [];

  for (const f of mdFiles) {
    try {
      const parsed = await parseWorkspaceFile<OrganizationFrontmatter>(join(orgsDir, f));
      if (parsed.frontmatter.type === "organization") {
        orgs.push(parsed);
      }
    } catch {
      // Skip unparseable files
    }
  }

  return orgs;
}

/** Ensure the organizations directory exists. */
export async function ensureOrganizationsDir(workspaceRoot: string): Promise<void> {
  await mkdir(join(workspaceRoot, ORGANIZATIONS_DIR), { recursive: true });
}
