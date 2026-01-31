import { Brain, Calendar } from "lucide-react";
import { Card, CardInset } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { readMemoryLogs, readLongTermMemory } from "@/lib/reader";

export default async function MemoryPage() {
  const [logs, longTerm] = await Promise.all([readMemoryLogs(30), readLongTermMemory()]);

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-headline text-[var(--text-primary)] mb-1">Memory</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Daily structured logs and long-term curated memory
        </p>
      </div>

      {/* Long-term memory */}
      {longTerm && (
        <Card hover={false} padding="lg">
          <div className="flex items-center gap-2 mb-3">
            <Brain size={16} className="text-[var(--accent)]" />
            <h2 className="text-title text-[var(--text-primary)]">Long-Term Memory</h2>
          </div>
          <div className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">
            {longTerm.body || <span className="italic text-[var(--text-muted)]">Empty</span>}
          </div>
        </Card>
      )}

      {/* Daily Logs */}
      <div>
        <h2 className="text-title text-[var(--text-primary)] mb-4">Daily Logs</h2>
        {logs.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title="No memory logs"
            description="Log one with: awp memory log 'your entry here'"
          />
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-[15px] top-4 bottom-4 w-px bg-[var(--border)]" />

            <div className="space-y-4 stagger-children">
              {logs.map((log) => (
                <div key={log.date} className="flex gap-4 relative">
                  <div className="w-8 h-8 rounded-full bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center shrink-0 z-10">
                    <Calendar size={12} className="text-[var(--text-secondary)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-semibold text-[var(--text-primary)]">
                        {new Date(log.date + "T00:00:00").toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                      <span className="text-[10px] font-mono text-[var(--text-muted)]">
                        {log.entryCount} entries
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {log.entries.map((entry, i) => (
                        <CardInset key={i} className="!p-2.5">
                          <div className="flex items-start gap-2">
                            {entry.time && (
                              <span className="text-[10px] font-mono text-[var(--text-muted)] shrink-0 mt-0.5">
                                {entry.time}
                              </span>
                            )}
                            <span className="text-xs text-[var(--text-primary)] leading-relaxed">
                              {entry.content}
                            </span>
                          </div>
                          {entry.tags && entry.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {entry.tags.map((tag) => (
                                <Badge key={tag} variant="default" size="sm">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </CardInset>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
