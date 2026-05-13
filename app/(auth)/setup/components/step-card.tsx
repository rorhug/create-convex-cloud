"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { ProviderLogo, type ProviderLogoName } from "./provider-logo";

type StepCardProps = {
  step: string;
  complete: boolean;
  optional?: boolean;
  children: ReactNode;
  provider: ProviderLogoName;
};

export function StepCard({ step, provider, complete, optional = false, children }: StepCardProps) {
  return (
    <div className="border border-border bg-background p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Step {step}</p>
          <ProviderLogo provider={provider} />
        </div>
        <Badge variant={complete ? "default" : "outline"}>
          {complete ? "Complete" : optional ? "Optional" : "Required"}
        </Badge>
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}
