"use client";

import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

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
    <main className="min-h-screen bg-slate-950 text-slate-50 p-8">
      <div className="mx-auto max-w-3xl rounded-3xl border border-slate-800 bg-slate-900 p-8">
        <p className="text-sm text-slate-400">Loading your workspace...</p>
      </div>
    </main>
  );
}
