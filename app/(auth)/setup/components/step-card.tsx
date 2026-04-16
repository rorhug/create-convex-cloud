"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { ProviderLogo, type ProviderLogoName } from "./provider-logo";

export function StepCard({
  step,
  provider,
  complete,
  children,
}: {
  step: string;
  provider: ProviderLogoName;
  complete: boolean;
  children: ReactNode;
}) {
  return (
    <div className="border border-border bg-background p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-3step">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Step {step}</p>
          <ProviderLogo provider={provider} />
        </div>
        <Badge variant={complete ? "default" : "outline"}>{complete ? "Complete" : "Required"}</Badge>
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}
