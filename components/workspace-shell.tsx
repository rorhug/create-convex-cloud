"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

export function WorkspaceShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { signOut } = useAuthActions();

  return (
    <main className="min-h-screen p-6 md:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-col gap-4 border border-border bg-card p-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-3">
            <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
              Create Convex Cloud
            </p>
            <nav className="flex flex-wrap gap-2">
              <Button asChild variant={pathname.startsWith("/setup") ? "default" : "outline"}>
                <Link href="/setup">Setup</Link>
              </Button>
              <Button asChild variant={pathname.startsWith("/apps") ? "default" : "outline"}>
                <Link href="/apps">Apps</Link>
              </Button>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button
              variant="outline"
              onClick={() => {
                void signOut();
              }}
            >
              Sign out
            </Button>
          </div>
        </header>

        {children}
      </div>
    </main>
  );
}
