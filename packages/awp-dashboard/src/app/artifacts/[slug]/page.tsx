import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, GitCommit } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ScoreGauge } from "@/components/ui/ScoreGauge";
import { readArtifact } from "@/lib/reader";

export default async function ArtifactDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const artifact = await readArtifact(slug);
  if (!artifact) notFound();

  const fm = artifact.frontmatter;

  return (
    <div className="space-y-6 max-w-4xl">
      <Link
        href="/artifacts"
        className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
      >
        <ArrowLeft size={12} /> Artifacts
      </Link>

      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex-1">
          <h1 className="text-headline text-[var(--text-primary)] mb-1">{fm.title}</h1>
          <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)]">
            <span className="font-mono">{fm.id}</span>
            <span>v{fm.version}</span>
            <span>
              Created{" "}
              {new Date(fm.created).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>
        </div>
        {fm.confidence !== undefined && (
          <ScoreGauge score={fm.confidence} size={64} label="confidence" />
        )}
      </div>

      {/* Tags */}
      {fm.tags && fm.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {fm.tags.map((tag) => (
            <Badge key={tag} variant="info" size="md">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {/* Body */}
      <Card hover={false} padding="lg">
        <div className="prose prose-sm prose-invert max-w-none text-[var(--text-primary)] whitespace-pre-wrap text-sm leading-relaxed">
          {artifact.body || <span className="text-[var(--text-muted)] italic">No content</span>}
        </div>
      </Card>

      {/* Provenance Timeline */}
      <Card hover={false} padding="lg">
        <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-4">
          Provenance ({fm.provenance?.length || 0} entries)
        </h3>
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-[11px] top-2 bottom-2 w-px bg-[var(--border)]" />

          <div className="space-y-4">
            {(fm.provenance || []).map((entry, i) => (
              <div key={i} className="flex gap-3 relative">
                <div className="w-6 h-6 rounded-full bg-[var(--surface-2)] border-2 border-[var(--accent)] flex items-center justify-center shrink-0 z-10">
                  <GitCommit size={10} className="text-[var(--accent)]" />
                </div>
                <div className="flex-1 pb-1">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        entry.action === "created"
                          ? "success"
                          : entry.action === "merged"
                            ? "info"
                            : "default"
                      }
                    >
                      {entry.action}
                    </Badge>
                    <span className="text-[10px] font-mono text-[var(--text-muted)]">
                      {new Date(entry.timestamp).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {entry.confidence !== undefined && (
                      <span className="text-[10px] font-mono text-[var(--text-muted)]">
                        conf: {(entry.confidence * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                  {entry.message && (
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">{entry.message}</p>
                  )}
                  <code className="text-[10px] font-mono text-[var(--text-muted)]">
                    {entry.agent.slice(0, 30)}…
                  </code>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Authors */}
      <Card hover={false} padding="md">
        <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-2">Authors</h3>
        <div className="space-y-1">
          {fm.authors.map((author) => (
            <code key={author} className="block text-xs font-mono text-[var(--text-muted)]">
              {author}
            </code>
          ))}
        </div>
      </Card>
    </div>
  );
}
