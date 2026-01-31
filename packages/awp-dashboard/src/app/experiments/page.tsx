import Link from "next/link";
import { FlaskConical, Users, Zap, Hash } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { listSocieties } from "@/lib/reader";

export const metadata = { title: "Experiments — AWP Dashboard" };

export default async function ExperimentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const societies = await listSocieties(status);

  return (
    <div className="space-y-6 max-w-5xl">
      <header>
        <h1 className="text-headline text-[var(--text-primary)]">Experiments</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Agent societies and experiment results
        </p>
      </header>

      {/* Status filter */}
      <div className="flex gap-2">
        {[undefined, "active", "paused", "archived"].map((s) => {
          const isActive = status === s || (!status && !s);
          const label = s ? s.charAt(0).toUpperCase() + s.slice(1) : "All";
          return (
            <Link
              key={label}
              href={s ? `/experiments?status=${s}` : "/experiments"}
              className={`
                px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                ${isActive
                  ? "bg-[var(--accent-glow-strong)] text-[var(--accent)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)]"
                }
              `}
            >
              {label}
            </Link>
          );
        })}
      </div>

      {societies.length === 0 ? (
        <EmptyState
          icon={FlaskConical}
          title="No societies found"
          description={status ? `No ${status} societies. Try a different filter.` : "Create a society with: awp experiment society create"}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
          {societies.map((s) => (
            <Link key={s.id} href={`/experiments/${s.id}`}>
              <Card>
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <code className="text-xs font-mono text-[var(--text-primary)] truncate max-w-[200px]">
                      {s.id}
                    </code>
                    <StatusBadge status={s.status} />
                  </div>

                  <div className="text-xs text-[var(--text-muted)] font-mono truncate">
                    {s.manifestoId}
                  </div>

                  <div className="flex items-center gap-4 text-xs text-[var(--text-secondary)]">
                    <span className="flex items-center gap-1">
                      <Users size={12} /> {s.agentCount} agents
                    </span>
                    <span className="flex items-center gap-1">
                      <Zap size={12} /> {s.currentCycle} cycles
                    </span>
                    <span className="flex items-center gap-1">
                      <Hash size={12} /> {s.experimentCount} exp
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-[var(--text-muted)]">
                      {new Date(s.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {s.experimentCount > 0 && (
                      <Badge variant="info" size="sm">
                        {s.experimentCount} result{s.experimentCount > 1 ? "s" : ""}
                      </Badge>
                    )}
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
