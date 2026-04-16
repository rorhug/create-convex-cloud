"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";

export default function SignIn() {
  const { signIn } = useAuthActions();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-8 shadow-2xl">
        <div className="space-y-4 text-center">
          <h1 className="text-3xl font-semibold">Sign in with GitHub</h1>
          <p className="text-sm text-muted-foreground">
            GitHub is the only login method enabled. Sign in first, then install the GitHub App on the setup page before
            creating apps.
          </p>
        </div>

        <div className="mt-8 space-y-4">
          <button
            className="flex w-full items-center justify-center rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
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
            <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
