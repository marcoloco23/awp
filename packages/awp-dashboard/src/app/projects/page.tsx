import Link from "next/link";
import { FolderKanban } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { listProjects } from "@/lib/reader";

export default async function ProjectsPage() {
  const projects = await listProjects();

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-headline text-[var(--text-primary)] mb-1">Projects</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Coordination projects with tasks, members, and reputation gates
        </p>
      </div>

      {projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects"
          description="Create one with: awp project create <slug>"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 stagger-children">
          {projects.map((p) => (
            <Link key={p.slug} href={`/projects/${p.slug}`}>
              <Card padding="lg" className="h-full">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-title text-[var(--text-primary)] mb-0.5">{p.title}</h3>
                    <span className="text-xs font-mono text-[var(--text-muted)]">{p.slug}</span>
                  </div>
                  <StatusBadge status={p.status} />
                </div>

                <ProgressBar
                  value={p.completedCount}
                  max={p.taskCount}
                  showLabel
                  className="mb-3"
                />

                <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                  <span>
                    {p.completedCount}/{p.taskCount} tasks
                  </span>
                  <span>{p.memberCount} member{p.memberCount !== 1 ? "s" : ""}</span>
                  {p.deadline && (
                    <span className="font-mono">
                      due {new Date(p.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  )}
                </div>

                {p.tags && p.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {p.tags.map((tag) => (
                      <span key={tag} className="text-[10px] font-mono text-[var(--text-muted)] bg-[var(--surface-2)] px-1.5 py-0.5 rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
