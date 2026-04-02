"use client";

import { statusToClass } from "@/lib/utils";

interface StatusPillProps {
  status: string;
  label?: string;
  size?: "sm" | "md";
}

export function StatusPill({ status, label, size = "md" }: StatusPillProps) {
  const cls = statusToClass(status);
  return (
    <span className={`pill ${cls} ${size === "sm" ? "text-[10px] px-1.5" : ""}`}>
      {label || status}
    </span>
  );
}
