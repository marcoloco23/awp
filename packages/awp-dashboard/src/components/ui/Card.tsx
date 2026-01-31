import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  padding?: "sm" | "md" | "lg";
}

const paddings = {
  sm: "p-3",
  md: "p-5",
  lg: "p-6",
};

export function Card({ children, className = "", hover = true, padding = "md" }: CardProps) {
  return (
    <div className={`card ${paddings[padding]} ${hover ? "" : "hover:border-[var(--border)] hover:shadow-none"} ${className}`}>
      {children}
    </div>
  );
}

export function CardInset({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`card-inset p-4 ${className}`}>{children}</div>;
}
