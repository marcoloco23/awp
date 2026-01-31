import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, TrendingUp } from "lucide-react";
import { Card, CardInset } from "@/components/ui/Card";
import { ScoreGauge } from "@/components/ui/ScoreGauge";
import { Badge } from "@/components/ui/Badge";
import { ReputationRadar } from "@/components/charts/ReputationRadar";
import { ScoreTimeline } from "@/components/charts/ScoreTimeline";
import { readReputationProfile } from "@/lib/reader";

export default async function ReputationDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = await readReputationProfile(slug);
  if (!profile) notFound();

  const fm = profile.frontmatter;

  return (
    <div className="space-y-6 max-w-5xl">
      <Link
        href="/reputation"
        className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
      >
        <ArrowLeft size={12} /> Reputation
      </Link>

      {/* Agent Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center text-lg font-bold text-[var(--accent)]">
          {fm.agentName[0]?.toUpperCase()}
        </div>
        <div>
          <h1 className="text-headline text-[var(--text-primary)]">{fm.agentName}</h1>
          <code className="text-xs font-mono text-[var(--text-muted)]">{fm.agentDid}</code>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Radar Chart */}
        <Card hover={false} padding="lg" className="lg:col-span-1">
          <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-2">Dimensions</h3>
          <ReputationRadar dimensions={profile.dimensions} />
        </Card>

        {/* Dimension Detail */}
        <Card hover={false} padding="lg" className="lg:col-span-2">
          <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-4">Score Breakdown</h3>
          <div className="space-y-4">
            {profile.dimensions.map((d) => (
              <div key={d.name} className="flex items-center gap-4">
                <ScoreGauge score={d.decayedScore} size={52} showValue />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-[var(--text-primary)] capitalize">
                      {d.name.replace(/-/g, " ")}
                    </span>
                    {d.score !== d.decayedScore && (
                      <span className="text-[10px] font-mono text-[var(--text-muted)]">
                        raw: {(d.score * 100).toFixed(0)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-[10px] font-mono text-[var(--text-muted)]">
                    <span>confidence: {(d.confidence * 100).toFixed(0)}%</span>
                    <span>samples: {d.sampleSize}</span>
                    <span>
                      last: {new Date(d.lastSignal).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Domain Competence */}
      {profile.domains.length > 0 && (
        <Card hover={false} padding="lg">
          <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-4">
            Domain Competence
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {profile.domains.map((d) => (
              <CardInset key={d.name}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-[var(--text-primary)]">{d.name}</span>
                  <span className="text-[10px] font-mono text-[var(--text-muted)]">
                    {d.sampleSize}x
                  </span>
                </div>
                <ScoreGauge score={d.decayedScore} size={48} showValue />
              </CardInset>
            ))}
          </div>
        </Card>
      )}

      {/* Score Timeline */}
      {profile.signals.length >= 2 && (
        <Card hover={false} padding="lg">
          <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-2">Score Timeline</h3>
          <ScoreTimeline signals={profile.signals} />
        </Card>
      )}

      {/* Signal History */}
      <Card hover={false} padding="lg">
        <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-4">
          Signal History ({profile.signals.length})
        </h3>
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {profile.signals
            .slice()
            .reverse()
            .map((s, i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-2.5 rounded-lg bg-[var(--surface-2)]"
              >
                <TrendingUp size={14} className="text-[var(--accent)] shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-[var(--text-primary)]">
                      {s.dimension}
                      {s.domain && `:${s.domain}`}
                    </span>
                    <Badge variant={s.score >= 0.7 ? "success" : s.score >= 0.4 ? "warning" : "danger"}>
                      {(s.score * 100).toFixed(0)}
                    </Badge>
                  </div>
                  {s.message && (
                    <span className="text-xs text-[var(--text-secondary)]">{s.message}</span>
                  )}
                </div>
                <span className="text-[10px] font-mono text-[var(--text-muted)] shrink-0">
                  {new Date(s.timestamp).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
            ))}
        </div>
      </Card>
    </div>
  );
}
