import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { AppShell } from "@/components/layout/AppShell";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

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
      <body className={`${inter.variable} ${jetbrains.variable}`}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
