import type { Metadata } from "next";
// Self-hosted fonts (bundled woff2 in node_modules) so the build is hermetic —
// no build-time or runtime fetch to Google Fonts. These register the
// "Inter Variable" / "JetBrains Mono Variable" families referenced in
// globals.css.
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import { AppShell } from "@/components/layout/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "AWP Dashboard",
    template: "%s — AWP Dashboard",
  },
  description: "Human governance dashboard for Agent Workspace Protocol — monitor projects, reputation, artifacts, contracts, and memory.",
  keywords: ["awp", "agent workspace protocol", "governance", "dashboard", "multi-agent"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
