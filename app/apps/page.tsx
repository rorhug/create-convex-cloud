"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Link from "next/link";
import { useState } from "react";

export default function AppsPage() {
  const viewer = useQuery(api.viewer.getViewer);

  if (viewer === undefined) {
    return (
      <main className="min-h-screen bg-slate-950 p-8 text-slate-50">
        <div className="mx-auto max-w-3xl rounded-3xl border border-slate-800 bg-slate-900 p-8">
          <p className="text-sm text-slate-400">Loading apps...</p>
        </div>
      </main>
    );
  }

  if (!viewer.onboarding.canAccessApps) {
    return (
      <main className="min-h-screen bg-slate-950 p-8 text-slate-50">
        <div className="mx-auto max-w-3xl rounded-3xl border border-slate-800 bg-slate-900 p-8">
          <p className="text-sm uppercase tracking-[0.2em] text-slate-400">
            Apps locked
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-white">
            Finish onboarding first
          </h1>
          <p className="mt-3 text-sm text-slate-300">
            You need a connected Vercel account and a saved Convex team access
            token before creating apps.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex rounded-xl bg-white px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-slate-200"
          >
            Back to setup
          </Link>
        </div>
      </main>
    );
  }

  return <AppsManager />;
}

function AppsManager() {
  const apps = useQuery(api.apps.listApps);
  const createApp = useMutation(api.apps.createApp);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  return (
    <main className="min-h-screen bg-slate-950 p-8 text-slate-50">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="flex flex-col gap-3 rounded-3xl border border-slate-800 bg-slate-900 p-8 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-slate-400">
              Apps
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-white">
              Create an app
            </h1>
            <p className="mt-2 text-sm text-slate-300">
              This creates a document in the Convex <code>apps</code> table.
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex rounded-xl border border-slate-700 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-slate-500 hover:bg-slate-800"
          >
            Back to setup
          </Link>
        </header>

        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-8">
          <div className="space-y-4">
            <label className="block text-sm font-medium text-slate-200">
              App name
            </label>
            <div className="flex flex-col gap-3 md:flex-row">
              <input
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setError(null);
                }}
                placeholder="My app"
                className="flex-1 rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-slate-500"
              />
              <button
                className="rounded-2xl bg-white px-5 py-3 text-sm font-medium text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                disabled={isCreating || name.trim().length === 0}
                onClick={() => {
                  void handleCreate();
                }}
              >
                {isCreating ? "Creating..." : "Create app"}
              </button>
            </div>
            {error && (
              <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {error}
              </div>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-8">
          <h2 className="text-xl font-semibold text-white">Your apps</h2>
          <div className="mt-4 space-y-3">
            {apps === undefined && (
              <p className="text-sm text-slate-400">Loading existing apps...</p>
            )}
            {apps?.length === 0 && (
              <p className="text-sm text-slate-400">
                No apps yet. Create your first one above.
              </p>
            )}
            {apps?.map((app) => (
              <div
                key={app._id}
                className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3"
              >
                <p className="font-medium text-white">{app.name}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );

  async function handleCreate() {
    setIsCreating(true);
    setError(null);
    try {
      await createApp({ name });
      setName("");
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Could not create the app",
      );
    } finally {
      setIsCreating(false);
    }
  }
}
