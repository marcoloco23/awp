import { FileQuestion, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-4">
      <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)]">
        <FileQuestion size={28} className="text-[var(--text-muted)]" />
      </div>

      <div className="text-center max-w-md">
        <h2 className="text-title text-[var(--text-primary)] mb-2">
          Page not found
        </h2>
        <p className="text-sm text-[var(--text-secondary)]">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
      </div>

      <Link
        href="/"
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg
          bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-primary)]
          hover:border-[var(--accent)] hover:bg-[var(--accent-glow)] transition-colors"
      >
        <ArrowLeft size={14} />
        Back to dashboard
      </Link>
    </div>
  );
}
