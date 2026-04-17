"use client";

import { useConvexAuth } from "convex/react";
import { AboutContent } from "@/components/about-content";
import { WorkspaceShell } from "@/components/workspace-shell";
import { Spinner } from "@/components/ui/spinner";

export default function AboutPage() {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();

  if (authLoading) {
    return (
      <main className="min-h-screen p-8">
        <div className="mx-auto max-w-3xl border border-border bg-card p-8">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner />
            Loading…
          </div>
        </div>
      </main>
    );
  }

  if (isAuthenticated) {
    return (
      <WorkspaceShell>
        <AboutContent />
      </WorkspaceShell>
    );
  }

  return (
    <main className="min-h-screen p-8">
      <AboutContent showSignInCta />
    </main>
  );
}
