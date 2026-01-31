import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, CardInset } from "@/components/ui/Card";
import { StatusBadge, PriorityBadge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { TaskDistribution } from "@/components/charts/TaskDistribution";
import { readProject } from "@/lib/reader";
import type { TaskSummary } from "@/lib/types";

const COLUMNS: { key: TaskSummary["status"]; label: string; color: string }[] = [
  { key: "pending", label: "Pending", color: "var(--text-muted)" },
  { key: "in-progress", label: "In Progress", color: "var(--accent)" },
  { key: "blocked", label: "Blocked", color: "var(--danger)" },
  { key: "review", label: "Review", color: "var(--warning)" },
  { key: "completed", label: "Completed", color: "var(--success)" },
];

export default async function ProjectDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = await readProject(slug);
  if (!project) notFound();

  const fm = project.frontmatter;

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Breadcrumb */}
      <Link
        href="/projects"
        className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
      >
        <ArrowLeft size={12} /> Projects
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-headline text-[var(--text-primary)] mb-1">{fm.title}</h1>
          <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)]">
            <span className="font-mono">{slug}</span>
            {fm.deadline && (
              <span>
                Deadline:{" "}
                {new Date(fm.deadline).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            )}
            <span>{fm.members?.length || 0} members</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={fm.status} />
          <ProgressBar value={fm.completedCount} max={fm.taskCount} showLabel className="w-32" />
        </div>
      </div>

      {/* Task Distribution Chart */}
      {project.tasks.length > 0 && (
        <Card hover={false} padding="md">
          <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-2">Task Distribution</h3>
          <TaskDistribution tasks={project.tasks} />
        </Card>
      )}

      {/* Task Board */}
      {project.tasks.length === 0 ? (
        <EmptyState title="No tasks yet" description={`Create one with: awp task create ${slug} <task-slug>`} />
      ) : (
        <div className="grid grid-cols-5 gap-3 min-h-[300px]">
          {COLUMNS.map(({ key, label, color }) => {
            const tasks = project.tasks.filter((t) => t.status === key);
            return (
              <div key={key}>
                <div className="flex items-center gap-2 mb-3 px-1">
                  <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                  <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                    {label}
                  </span>
                  <span className="text-[10px] font-mono text-[var(--text-muted)] ml-auto">
                    {tasks.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {tasks.map((task) => (
                    <CardInset key={task.slug} className="!p-3">
                      <div className="flex items-start justify-between mb-1.5">
                        <span className="text-sm font-medium text-[var(--text-primary)] leading-tight">
                          {task.title}
                        </span>
                        <PriorityBadge priority={task.priority} />
                      </div>
                      {task.assigneeSlug && (
                        <div className="text-[10px] font-mono text-[var(--text-muted)] mb-1.5">
                          @{task.assigneeSlug}
                        </div>
                      )}
                      {task.blockedBy.length > 0 && (
                        <div className="text-[10px] text-[var(--danger)] font-mono">
                          blocked by {task.blockedBy.length} task{task.blockedBy.length > 1 ? "s" : ""}
                        </div>
                      )}
                      {task.deadline && (
                        <div className="text-[10px] font-mono text-[var(--text-muted)] mt-1">
                          due{" "}
                          {new Date(task.deadline).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </div>
                      )}
                    </CardInset>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Members */}
      {fm.members && fm.members.length > 0 && (
        <Card hover={false} padding="md">
          <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-3">Members</h3>
          <div className="space-y-2">
            {fm.members.map((m) => (
              <div key={m.did} className="flex items-center gap-3 text-sm">
                <div className="w-7 h-7 rounded-full bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center text-xs font-mono text-[var(--text-secondary)]">
                  {m.slug?.[0]?.toUpperCase() || "?"}
                </div>
                <span className="text-[var(--text-primary)]">{m.slug}</span>
                <StatusBadge status={m.role} />
                <code className="text-[10px] font-mono text-[var(--text-muted)] ml-auto">
                  {m.did.slice(0, 24)}…
                </code>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
