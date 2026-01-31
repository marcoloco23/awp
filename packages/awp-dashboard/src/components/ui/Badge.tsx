interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger" | "info" | "muted";
  size?: "sm" | "md";
}

const variantStyles: Record<string, string> = {
  default: "bg-[var(--surface-2)] text-[var(--text-secondary)] border-[var(--border)]",
  success: "bg-[var(--success-dim)] text-[var(--success)] border-[var(--success)]/20",
  warning: "bg-[var(--warning-dim)] text-[var(--warning)] border-[var(--warning)]/20",
  danger: "bg-[var(--danger-dim)] text-[var(--danger)] border-[var(--danger)]/20",
  info: "bg-[var(--info-dim)] text-[var(--info)] border-[var(--info)]/20",
  muted: "bg-[var(--surface-2)] text-[var(--text-muted)] border-[var(--border-subtle)]",
};

export function Badge({ children, variant = "default", size = "sm" }: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center font-mono border rounded-md
        ${size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-0.5"}
        ${variantStyles[variant]}
      `}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const variantMap: Record<string, BadgeProps["variant"]> = {
    active: "success",
    "in-progress": "info",
    completed: "success",
    evaluated: "success",
    pending: "muted",
    blocked: "danger",
    review: "warning",
    draft: "muted",
    paused: "warning",
    cancelled: "muted",
    archived: "muted",
  };
  return <Badge variant={variantMap[status] || "default"}>{status}</Badge>;
}

export function PriorityBadge({ priority }: { priority: string }) {
  const variantMap: Record<string, BadgeProps["variant"]> = {
    critical: "danger",
    high: "warning",
    medium: "info",
    low: "muted",
  };
  return (
    <Badge variant={variantMap[priority] || "default"} size="sm">
      {priority}
    </Badge>
  );
}
