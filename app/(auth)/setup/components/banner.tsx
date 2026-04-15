"use client";

import type { ReactNode } from "react";

export function Banner({
  tone,
  children,
}: {
  tone: "success" | "error";
  children: ReactNode;
}) {
  return (
    <div
      className={`border px-4 py-3 text-sm ${
        tone === "success"
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-destructive/30 bg-destructive/10 text-destructive"
      }`}
    >
      {children}
    </div>
  );
}
