"use client";
import type { CSSProperties, ReactNode } from "react";

export function ClubhouseBottomNav({ children, count = 5, label = "Mobile navigation", persistent = false }: {
  children: ReactNode; count?: number; label?: string; persistent?: boolean;
}) {
  return <nav className={`bottom-nav${persistent ? " bottom-nav--persistent" : ""}`} aria-label={label} style={{ "--bottom-nav-count": count } as CSSProperties}>{children}</nav>;
}
