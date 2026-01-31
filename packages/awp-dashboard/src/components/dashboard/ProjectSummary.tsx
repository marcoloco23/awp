import Link from "next/link";
import { FolderKanban, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { EmptyState } from "@/components/ui/EmptyState";
import type { ProjectSummary as ProjectSummaryType } from "@/lib/types";

export function ProjectSummary({ projects }: { projects: ProjectSummaryType[] }) {
  return (
    <Card hover={false} padding="lg">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-title text-[var(--text-primary)]">Projects</h2>
        <Link
          href="/projects"
          className="text-xs text-[var(--accent)] hover:underline flex items-center gap-0.5"
        >
          View all <ChevronRight size={12} />
        </Link>
      </div>

      {projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          description="Create one with: awp project create <slug>"
        />
      ) : (
        <div className="space-y-3">
          {projects.slice(0, 5).map((p) => (
            <Link
              key={p.slug}
              href={`/projects/${p.slug}`}
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-[var(--surface-2)] transition-colors group"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-[var(--text-primary)] truncate group-hover:text-[var(--accent)] transition-colors">
                    {p.title}
                  </span>
                  <StatusBadge status={p.status} />
                </div>
                <ProgressBar value={p.completedCount} max={p.taskCount} />
              </div>
              <div className="text-right shrink-0">
                <span className="text-xs font-mono text-[var(--text-muted)]">
                  {p.completedCount}/{p.taskCount}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}
