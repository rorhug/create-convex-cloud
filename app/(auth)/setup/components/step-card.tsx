"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";

export function StepCard({
  step,
  title,
  complete,
  children,
}: {
  step: string;
  title: string;
  complete: boolean;
  children: ReactNode;
}) {
  return (
    <div className="border border-border bg-background p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Step {step}
          </p>
          <h3 className="mt-1 text-lg font-medium">{title}</h3>
        </div>
        <Badge variant={complete ? "default" : "outline"}>
          {complete ? "Complete" : "Required"}
        </Badge>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}
