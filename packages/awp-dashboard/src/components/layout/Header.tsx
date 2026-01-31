import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { readIdentity, readManifest } from "@/lib/reader";

export async function Header() {
  const identity = await readIdentity();
  const manifest = await readManifest();

  return (
    <header
      className="fixed top-0 right-0 z-30 flex items-center justify-between px-6 border-b border-[var(--border)] bg-[var(--surface-1)]/80 backdrop-blur-md"
      style={{
        left: "var(--sidebar-width)",
        height: "var(--header-height)",
      }}
    >
      <div className="flex items-center gap-3">
        {identity && (
          <>
            <span className="text-xl">{identity.frontmatter.emoji || "🤖"}</span>
            <div>
              <span className="text-sm font-semibold text-[var(--text-primary)]">
                {identity.frontmatter.name}
              </span>
              <span className="text-xs text-[var(--text-muted)] ml-2 font-mono">
                v{manifest?.awp || "?"}
              </span>
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        {manifest?.agent?.did && (
          <code className="text-[10px] font-mono text-[var(--text-muted)] bg-[var(--surface-2)] px-2 py-0.5 rounded">
            {manifest.agent.did.slice(0, 20)}…
          </code>
        )}
        <ThemeToggle />
      </div>
    </header>
  );
}
