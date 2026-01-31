"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();

  return (
    <button
      onClick={toggle}
      className="relative flex items-center justify-center w-8 h-8 rounded-lg transition-colors hover:bg-[var(--surface-2)]"
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      {theme === "dark" ? (
        <Sun size={16} className="text-[var(--text-secondary)]" />
      ) : (
        <Moon size={16} className="text-[var(--text-secondary)]" />
      )}
    </button>
  );
}
