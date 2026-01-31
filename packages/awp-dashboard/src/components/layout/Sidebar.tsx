"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import {
  LayoutDashboard,
  FolderKanban,
  Shield,
  BookOpen,
  FileText,
  Brain,
  Activity,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/reputation", label: "Reputation", icon: Shield },
  { href: "/artifacts", label: "Artifacts", icon: BookOpen },
  { href: "/contracts", label: "Contracts", icon: FileText },
  { href: "/memory", label: "Memory", icon: Brain },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="fixed left-0 top-0 bottom-0 z-40 flex flex-col border-r border-[var(--border)]"
      style={{
        width: "var(--sidebar-width)",
        background: "var(--surface-1)",
      }}
    >
      {/* Logo Area */}
      <div className="flex items-center gap-3 px-5 h-14 border-b border-[var(--border)] glow-line">
        <div className="flex items-center justify-center w-7 h-7 rounded-md bg-[var(--accent)] text-white font-bold text-xs">
          AW
        </div>
        <div>
          <div className="text-sm font-semibold text-[var(--text-primary)] tracking-tight">
            AWP Dashboard
          </div>
          <div className="text-[10px] font-mono text-[var(--text-muted)] tracking-wider uppercase">
            Governance
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-3 space-y-0.5 overflow-y-auto">
        <div className="text-[10px] font-mono text-[var(--text-muted)] tracking-wider uppercase px-2.5 py-2">
          Workspace
        </div>
        {navItems.map(({ href, label, icon: Icon }, i) => {
          const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <motion.div
              key={href}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.05 + i * 0.05, ease: "easeOut" }}
            >
              <Link
                href={href}
                className={`
                  flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-all
                  ${
                    isActive
                      ? "bg-[var(--accent-glow-strong)] text-[var(--accent)] font-medium"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)]"
                  }
                `}
              >
                <Icon size={16} strokeWidth={isActive ? 2 : 1.5} />
                {label}
                {isActive && (
                  <motion.div
                    layoutId="sidebar-indicator"
                    className="ml-auto w-1.5 h-1.5 rounded-full bg-[var(--accent)] shadow-[0_0_6px_var(--accent)]"
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  />
                )}
              </Link>
            </motion.div>
          );
        })}
      </nav>

      {/* Status Indicator */}
      <div className="px-4 py-3 border-t border-[var(--border)]">
        <div className="flex items-center gap-2">
          <Activity size={12} className="text-[var(--success)]" />
          <span className="text-[10px] font-mono text-[var(--text-muted)] tracking-wider uppercase">
            Read-only
          </span>
        </div>
      </div>
    </aside>
  );
}
