"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";

export function SignInCard() {
  const { signIn } = useAuthActions();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <div className="w-full rounded-3xl border border-border bg-card p-4 shadow-lg space-y-4">
      <h2 className="text-center font-semibold">Get started</h2>

      <button
        type="button"
        className="flex w-full cursor-pointer items-center justify-center rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
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
        {loading ? "Redirecting to GitHub…" : "Continue with GitHub"}
      </button>

      {error ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}
    </div>
  );
}
