"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { signOut } = useAuthActions();

  return (
    <main className="min-h-screen p-6 md:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex gap-4 border border-border bg-card p-6 flex-col">
          <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Create Convex Cloud</p>
          <div className=" flex items-center justify-between w-full">
            <nav className="flex flex-wrap gap-2">
              <Button asChild variant={pathname.startsWith("/setup") ? "default" : "outline"}>
                <Link href="/setup">Setup</Link>
              </Button>
              <Button asChild variant={pathname.startsWith("/apps") ? "default" : "outline"}>
                <Link href="/apps">Apps</Link>
              </Button>
            </nav>
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
          </div>
        </header>

        {children}
      </div>
    </main>
  );
}
