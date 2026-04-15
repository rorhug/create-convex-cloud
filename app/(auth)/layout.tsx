"use client";

import { Authenticated } from "convex/react";
import { WorkspaceShell } from "@/components/workspace-shell";

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <Authenticated>
      <WorkspaceShell>{children}</WorkspaceShell>
    </Authenticated>
  );
}
