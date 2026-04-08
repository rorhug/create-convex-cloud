"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";

export default function SignIn() {
  const { signIn } = useAuthActions();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-50">
      <div className="w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-900 p-8 shadow-2xl shadow-slate-950/40">
        <div className="space-y-4 text-center">
          <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Create Convex Cloud</p>
          <h1 className="text-3xl font-semibold text-white">Sign in with GitHub</h1>
          <p className="text-sm text-slate-300">
            GitHub is the only login method enabled. Sign in first, then install the
            GitHub App on the setup page before creating apps.
          </p>
        </div>

        <div className="mt-8 space-y-4">
          <button
            className="flex w-full items-center justify-center rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            disabled={loading}
            onClick={() => {
              setError(null);
              setLoading(true);
              void signIn("github", { redirectTo: "/" })
                .then(({ redirect }) => {
                  if (redirect) {
                    window.location.href = redirect.toString();
                  }
                })
                .catch((signInError) => {
                  setError(signInError instanceof Error ? signInError.message : "Could not start GitHub sign-in");
                })
                .finally(() => {
                  setLoading(false);
                });
            }}
          >
            {loading ? "Redirecting to GitHub..." : "Continue with GitHub"}
          </button>

          {error && (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {error}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
