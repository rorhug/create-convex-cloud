"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { ProviderLogo, type ProviderLogoName } from "./provider-logo";

type StepCardProps = {
  step: string;
  complete: boolean;
  children: ReactNode;
  /** Render a provider logo as the heading. */
  provider?: ProviderLogoName;
  /** Render a text title as the heading (used instead of `provider`). */
  title?: string;
  /** Optional description shown beneath a `title` heading. */
  description?: string;
};

export function StepCard({ step, provider, title, description, complete, children }: StepCardProps) {
  return (
    <div className="border border-border bg-background p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Step {step}</p>
          {provider ? (
            <ProviderLogo provider={provider} />
          ) : (
            <div className="space-y-1">
              {title ? (
                <h2 className="text-2xl font-bold tracking-tight text-foreground">{title}</h2>
              ) : null}
              {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
            </div>
          )}
        </div>
        <Badge variant={complete ? "default" : "outline"}>{complete ? "Complete" : "Required"}</Badge>
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}
