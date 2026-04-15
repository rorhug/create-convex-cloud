"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Spinner } from "@/components/ui/spinner";
import { Content } from "./content";

export default function SetupPage() {
  const viewer = useQuery(api.client.viewer.getViewer);

  if (viewer === undefined) {
    return (
      <div className="mx-auto max-w-3xl border border-border bg-card p-8">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner />
          Loading your workspace...
        </div>
      </div>
    );
  }

  return (
    <>
      <section className="border border-border bg-card p-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold">
            Connect GitHub, Vercel, and Convex
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Finish the three onboarding steps below, then head to <code>/apps</code>{" "}
            to create apps.
          </p>
        </div>
      </section>

      <div className="space-y-6">
        <Content viewer={viewer} />
      </div>
    </>
  );
}
