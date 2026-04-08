"use client";

import type { ReactNode } from "react";

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
    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
            Step {step}
          </p>
          <h3 className="mt-1 text-lg font-medium text-white">{title}</h3>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            complete
              ? "bg-emerald-500/15 text-emerald-300"
              : "bg-amber-500/15 text-amber-300"
          }`}
        >
          {complete ? "Complete" : "Required"}
        </span>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}
