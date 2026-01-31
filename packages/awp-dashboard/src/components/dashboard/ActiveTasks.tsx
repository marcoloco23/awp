import Link from "next/link";
import { ListChecks } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { StatusBadge, PriorityBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { readProject } from "@/lib/reader";
import type { ProjectSummary } from "@/lib/types";

interface ActiveTask {
  projectSlug: string;
  taskSlug: string;
  title: string;
  status: string;
  priority: string;
  assigneeSlug?: string;
}

export async function ActiveTasks({ projects }: { projects: ProjectSummary[] }) {
  const activeTasks: ActiveTask[] = [];

  for (const p of projects) {
    const detail = await readProject(p.slug);
    if (!detail) continue;
    for (const t of detail.tasks) {
      if (t.status === "in-progress" || t.status === "blocked" || t.status === "review") {
        activeTasks.push({
          projectSlug: p.slug,
          taskSlug: t.slug,
          title: t.title,
          status: t.status,
          priority: t.priority,
          assigneeSlug: t.assigneeSlug,
        });
      }
    }
  }

  return (
    <Card hover={false} padding="lg">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-title text-[var(--text-primary)]">Active Tasks</h2>
        <span className="text-xs font-mono text-[var(--text-muted)]">
          {activeTasks.length} active
        </span>
      </div>

      {activeTasks.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="No active tasks"
          description="All tasks are pending or completed"
        />
      ) : (
        <div className="space-y-2">
          {activeTasks.slice(0, 8).map((t) => (
            <Link
              key={`${t.projectSlug}/${t.taskSlug}`}
              href={`/projects/${t.projectSlug}`}
              className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-[var(--surface-2)] transition-colors group"
            >
              <div
                className="w-1 h-8 rounded-full shrink-0"
                style={{
                  background:
                    t.priority === "critical"
                      ? "var(--danger)"
                      : t.priority === "high"
                        ? "#f97316"
                        : t.priority === "medium"
                          ? "var(--accent)"
                          : "var(--text-muted)",
                }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-[var(--text-primary)] truncate group-hover:text-[var(--accent)] transition-colors">
                  {t.title}
                </div>
                <div className="text-[10px] font-mono text-[var(--text-muted)]">
                  {t.projectSlug}
                  {t.assigneeSlug && <> · @{t.assigneeSlug}</>}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <PriorityBadge priority={t.priority} />
                <StatusBadge status={t.status} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}
