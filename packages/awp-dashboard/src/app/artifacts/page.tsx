import Link from "next/link";
import { BookOpen } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { listArtifacts } from "@/lib/reader";

export default async function ArtifactsPage() {
  const artifacts = await listArtifacts();

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-headline text-[var(--text-primary)] mb-1">Knowledge Artifacts</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Versioned knowledge with provenance, confidence, and collaborative authorship
        </p>
      </div>

      {artifacts.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No artifacts"
          description="Create one with: awp artifact create <slug>"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
          {artifacts.map((a) => (
            <Link key={a.slug} href={`/artifacts/${a.slug}`}>
              <Card padding="md" className="h-full">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)] leading-tight">
                    {a.title}
                  </h3>
                  <span className="text-[10px] font-mono text-[var(--text-muted)] shrink-0 ml-2">
                    v{a.version}
                  </span>
                </div>

                {a.confidence !== undefined && (
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex-1 h-1 rounded-full bg-[var(--surface-2)] overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${a.confidence * 100}%`,
                          background:
                            a.confidence >= 0.7
                              ? "var(--rep-high)"
                              : a.confidence >= 0.4
                                ? "var(--rep-mid)"
                                : "var(--rep-low)",
                        }}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-[var(--text-muted)]">
                      {(a.confidence * 100).toFixed(0)}% conf
                    </span>
                  </div>
                )}

                <div className="flex flex-wrap gap-1 mb-2">
                  {a.tags?.map((tag) => (
                    <Badge key={tag} variant="default" size="sm">
                      {tag}
                    </Badge>
                  ))}
                </div>

                <div className="flex items-center justify-between text-[10px] font-mono text-[var(--text-muted)]">
                  <span>{a.authors.length} author{a.authors.length !== 1 ? "s" : ""}</span>
                  <span>
                    {new Date(a.lastModified || a.created).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
