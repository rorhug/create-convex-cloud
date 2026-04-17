"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { useTheme } from "next-themes";
import { SunIcon, MoonIcon, MonitorIcon, SignOutIcon } from "@phosphor-icons/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { signOut } = useAuthActions();
  const viewer = useQuery(api.client.viewer.getViewer);
  const { theme, setTheme } = useTheme();

  return (
    <main className="min-h-screen p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="flex gap-4 border border-border bg-card p-6 flex-col">
          <div className="flex items-center justify-between w-full">
            <nav className="flex flex-wrap gap-2">
              <Button asChild variant={pathname.startsWith("/setup") ? "default" : "outline"}>
                <Link href="/setup">Setup</Link>
              </Button>
              <Button asChild variant={pathname.startsWith("/apps") ? "default" : "outline"}>
                <Link href="/apps">Apps</Link>
              </Button>
              <Button asChild variant={pathname.startsWith("/about") ? "default" : "outline"}>
                <Link href="/about">About</Link>
              </Button>
            </nav>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
                  <Avatar>
                    {viewer?.user.image && <AvatarImage src={viewer.user.image} alt={viewer.user.name ?? "User"} />}
                    <AvatarFallback>
                      {(viewer?.user.name ?? viewer?.user.githubUsername ?? "?").charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex items-center gap-3">
                    <Avatar size="sm">
                      {viewer?.user.image && <AvatarImage src={viewer.user.image} alt={viewer.user.name ?? "User"} />}
                      <AvatarFallback>
                        {(viewer?.user.name ?? viewer?.user.githubUsername ?? "?").charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col gap-0.5 leading-none">
                      {viewer?.user.name && <span className="font-medium">{viewer.user.name}</span>}
                      {viewer?.user.githubUsername && (
                        <span className="text-xs text-muted-foreground">@{viewer.user.githubUsername}</span>
                      )}
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Theme</DropdownMenuLabel>
                  <DropdownMenuCheckboxItem checked={theme === "light"} onCheckedChange={() => setTheme("light")}>
                    <SunIcon className="size-4" />
                    Light
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked={theme === "dark"} onCheckedChange={() => setTheme("dark")}>
                    <MoonIcon className="size-4" />
                    Dark
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked={theme === "system"} onCheckedChange={() => setTheme("system")}>
                    <MonitorIcon className="size-4" />
                    System
                  </DropdownMenuCheckboxItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => void signOut()}>
                  <SignOutIcon className="size-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {children}
      </div>
    </main>
  );
}
