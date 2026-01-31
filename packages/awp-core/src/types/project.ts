import type { BaseFrontmatter } from "./workspace.js";

/**
 * A project member with role and optional reputation gates
 */
export interface ProjectMember {
  did: string;
  role: string;
  slug: string;
  minReputation?: Record<string, number>;
}

/**
 * Project frontmatter (projects/<slug>.md)
 */
export interface ProjectFrontmatter extends BaseFrontmatter {
  type: "project";
  cdp: string;
  id: string;
  title: string;
  status: "draft" | "active" | "paused" | "completed" | "archived";
  owner: string;
  created: string;
  deadline?: string;
  members: ProjectMember[];
  tags?: string[];
  taskCount: number;
  completedCount: number;
}

/**
 * Task frontmatter (projects/<project-slug>/tasks/<task-slug>.md)
 */
export interface TaskFrontmatter extends BaseFrontmatter {
  type: "task";
  cdp: string;
  id: string;
  projectId: string;
  title: string;
  status:
    | "pending"
    | "in-progress"
    | "blocked"
    | "review"
    | "completed"
    | "cancelled";
  assignee?: string;
  assigneeSlug?: string;
  priority: "low" | "medium" | "high" | "critical";
  created: string;
  deadline?: string;
  blockedBy: string[];
  blocks: string[];
  outputArtifact?: string;
  contractSlug?: string;
  tags?: string[];
}
