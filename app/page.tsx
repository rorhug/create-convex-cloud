"use client";

import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AboutContent } from "@/components/about-content";
import { Spinner } from "@/components/ui/spinner";

export default function Home() {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const viewer = useQuery(api.client.viewer.getViewer, isAuthenticated ? {} : "skip");
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated || authLoading) {
      return;
    }
    if (viewer === undefined) {
      return;
    }
    if (viewer.onboarding.canAccessApps) {
      void router.replace("/apps");
    } else {
      void router.replace("/setup");
    }
  }, [isAuthenticated, authLoading, viewer, router]);

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

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen p-8">
        <AboutContent showSignInCta />
      </main>
    );
  }

  if (viewer === undefined) {
    return (
      <main className="min-h-screen p-8">
        <div className="mx-auto max-w-3xl border border-border bg-card p-8">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner />
            Loading your workspace…
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-3xl border border-border bg-card p-8">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner />
          Redirecting…
        </div>
      </div>
    </main>
  );
}
