"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import Link from "next/link";
import { useAuthActions } from "@convex-dev/auth/react";
import { Content } from "./content";

export default function SetupPage() {
  const viewer = useQuery(api.client.viewer.getViewer);

  if (viewer === undefined) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 p-8">
        <div className="mx-auto max-w-3xl rounded-3xl border border-slate-800 bg-slate-900 p-8">
          <p className="text-sm text-slate-400">Loading your workspace...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 p-6 md:p-10">
        <header className="flex flex-col gap-4 rounded-3xl border border-slate-800 bg-slate-900/90 p-6 shadow-2xl shadow-slate-950/40 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <p className="text-sm uppercase tracking-[0.2em] text-slate-400">
              Create Convex Cloud
            </p>
            <h1 className="text-3xl font-semibold text-white">
              Connect GitHub, Vercel, and Convex
            </h1>
            <p className="max-w-2xl text-sm text-slate-300">
              Finish the three onboarding steps below, then head to{" "}
              <code>/apps</code> to create apps.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {viewer.onboarding.canAccessApps && (
              <Link
                href="/apps"
                className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-slate-200"
              >
                Open apps
              </Link>
            )}
            <SignOutButton />
          </div>
        </header>

        <Content viewer={viewer} />
      </div>
    </main>
  );
}

function SignOutButton() {
  const { signOut } = useAuthActions();
  return (
    <button
      className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-slate-500 hover:bg-slate-800"
      onClick={() => {
        void signOut();
      }}
    >
      Sign out
    </button>
  );
}
