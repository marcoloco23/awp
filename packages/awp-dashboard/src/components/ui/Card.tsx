"use client";

import { motion } from "motion/react";
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
  if (!hover) {
    return (
      <div className={`card ${paddings[padding]} hover:border-[var(--border)] hover:shadow-none ${className}`}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      className={`card ${paddings[padding]} ${className}`}
      whileHover={{ scale: 1.01, transition: { duration: 0.2 } }}
    >
      {children}
    </motion.div>
  );
}

export function CardInset({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`card-inset p-4 ${className}`}>{children}</div>;
}
