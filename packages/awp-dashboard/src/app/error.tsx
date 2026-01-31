"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-4">
      <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--danger-dim)] border border-[var(--danger)]/20">
        <AlertTriangle size={28} className="text-[var(--danger)]" />
      </div>

      <div className="text-center max-w-md">
        <h2 className="text-title text-[var(--text-primary)] mb-2">
          Something went wrong
        </h2>
        <p className="text-sm text-[var(--text-secondary)] mb-1">
          {error.message || "An unexpected error occurred while loading this page."}
        </p>
        {error.digest && (
          <p className="text-xs font-mono text-[var(--text-muted)]">
            Error ID: {error.digest}
          </p>
        )}
      </div>

      <button
        onClick={reset}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg
          bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-primary)]
          hover:border-[var(--accent)] hover:bg-[var(--accent-glow)] transition-colors"
      >
        <RefreshCw size={14} />
        Try again
      </button>
    </div>
  );
}
