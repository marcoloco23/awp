import type { IdentityFrontmatter, SoulFrontmatter, WorkspaceManifest } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";

interface Props {
  identity: { frontmatter: IdentityFrontmatter; body: string } | null;
  soul: { frontmatter: SoulFrontmatter; body: string } | null;
  manifest: WorkspaceManifest | null;
}

export function AgentIdentityCard({ identity, soul, manifest }: Props) {
  if (!identity) return null;
  const fm = identity.frontmatter;

  return (
    <div className="card p-6 relative overflow-hidden">
      {/* Subtle gradient overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at top left, var(--accent-glow) 0%, transparent 60%)",
        }}
      />

      <div className="relative flex items-start gap-5">
        {/* Avatar */}
        <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] text-3xl shrink-0">
          {fm.emoji || "🤖"}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-headline text-[var(--text-primary)]">{fm.name}</h1>
            {fm.creature && (
              <span className="text-xs text-[var(--text-muted)]">{fm.creature}</span>
            )}
          </div>

          {soul?.frontmatter.vibe && (
            <p className="text-sm text-[var(--text-secondary)] mb-3 italic">
              &ldquo;{soul.frontmatter.vibe}&rdquo;
            </p>
          )}

          <div className="flex flex-wrap gap-1.5">
            {fm.capabilities?.map((cap) => (
              <Badge key={cap} variant="info" size="sm">
                {cap}
              </Badge>
            ))}
            {manifest?.protocols?.mcp && (
              <Badge variant="success" size="sm">MCP</Badge>
            )}
            {manifest?.protocols?.a2a && (
              <Badge variant="success" size="sm">A2A</Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
