"use client";

import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Spinner } from "@/components/ui/spinner";

export default function Home() {
  const viewer = useQuery(api.client.viewer.getViewer);
  const router = useRouter();

  useEffect(() => {
    if (viewer === undefined) {
      return;
    }
    if (viewer.onboarding.canAccessApps) {
      void router.replace("/apps");
    } else {
      void router.replace("/setup");
    }
  }, [viewer, router]);

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-3xl border border-border bg-card p-8">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner />
          Loading your workspace...
        </div>
      </div>
    </main>
  );
}
