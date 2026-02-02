import { RefreshCw, Globe, AlertTriangle, BookOpen, Shield } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { MetricCard } from "@/components/ui/MetricCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { readSyncOverview } from "@/lib/reader";

export default async function SyncPage() {
  const overview = await readSyncOverview();

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-headline text-[var(--text-primary)] mb-1">
          Workspace Federation
        </h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Sync artifacts and reputation signals between connected AWP workspaces
        </p>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 stagger-children">
        <MetricCard
          label="Remotes"
          value={overview.remotes.length}
          icon={Globe}
          index={0}
        />
        <MetricCard
          label="Artifacts Synced"
          value={overview.totalArtifactsSynced}
          icon={BookOpen}
          index={1}
        />
        <MetricCard
          label="Signals Synced"
          value={overview.totalSignalsSynced}
          icon={Shield}
          index={2}
        />
        <MetricCard
          label="Conflicts"
          value={overview.conflicts.length}
          icon={AlertTriangle}
          variant={overview.conflicts.length > 0 ? "accent" : "default"}
          index={3}
        />
      </div>

      {/* Remotes */}
      <section>
        <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
          Connected Remotes
        </h2>

        {overview.remotes.length === 0 ? (
          <EmptyState
            icon={Globe}
            title="No remotes configured"
            description="Connect a workspace with: awp sync remote add <name> <url>"
          />
        ) : (
          <div className="space-y-3 stagger-children">
            {overview.remotes.map((remote) => (
              <Card key={remote.name} padding="md">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                        {remote.name}
                      </h3>
                      <Badge
                        variant={remote.transport === "git-remote" ? "info" : "default"}
                        size="sm"
                      >
                        {remote.transport}
                      </Badge>
                      {remote.lastSync ? (
                        <Badge variant="success" size="sm">synced</Badge>
                      ) : (
                        <Badge variant="muted" size="sm">never synced</Badge>
                      )}
                    </div>
                    <p className="text-xs font-mono text-[var(--text-secondary)] mb-2 truncate">
                      {remote.url}
                    </p>
                    <div className="flex items-center gap-4 text-[10px] font-mono text-[var(--text-muted)]">
                      <span>{remote.trackedArtifacts} artifact{remote.trackedArtifacts !== 1 ? "s" : ""} tracked</span>
                      <span>{remote.signalsSynced} signal{remote.signalsSynced !== 1 ? "s" : ""} synced</span>
                      {remote.lastSync && (
                        <span>
                          last sync{" "}
                          {new Date(remote.lastSync).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      )}
                      <span>
                        added{" "}
                        {new Date(remote.added).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 ml-3">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        remote.lastSync ? "bg-[var(--success)]" : "bg-[var(--text-muted)]"
                      }`}
                    />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Conflicts */}
      {overview.conflicts.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
            <AlertTriangle size={14} className="text-[var(--warning)]" />
            Pending Conflicts
          </h2>
          <div className="space-y-3 stagger-children">
            {overview.conflicts.map((c) => (
              <Card key={`${c.artifact}-${c.remote}`} padding="md">
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                        {c.artifact}
                      </h3>
                      <StatusBadge status="blocked" />
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] mb-2">
                      {c.reason}
                    </p>
                    <div className="flex items-center gap-4 text-[10px] font-mono text-[var(--text-muted)]">
                      <span>local v{c.localVersion} ↔ remote v{c.remoteVersion}</span>
                      <span>from: {c.remote}</span>
                      <span>
                        detected{" "}
                        {new Date(c.detectedAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
            <p className="text-xs text-[var(--text-muted)]">
              Resolve with: <code className="font-mono">awp sync resolve &lt;slug&gt; --accept local|remote|merged</code>
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
