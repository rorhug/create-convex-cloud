"use client";

import { githubInstallationValidator } from "@/convex/lib/providers/github/data";
import { Infer } from "convex/values";

// export type SetupGithubInstallation = {
//   id: string;
//   accountId: number;
//   accountLogin: string;
//   accountType: string;
//   accountAvatarUrl?: string | undefined;
//   repositorySelection: string;
// };
export type SetupGithubInstallation = Infer<typeof githubInstallationValidator>;

export type SetupVercelTeam = {
  id: string;
  name?: string | undefined;
  slug: string;
};

export type SetupBusyState =
  | "github-refresh"
  | "vercel-refresh"
  | "vercel-save"
  | "github-pages-confirm"
  | "convex-refresh"
  | "convex"
  | null;

export type SetupViewerState = {
  user: {
    name: string | null;
    email: string | null;
    image: string | null;
    githubUsername: string | null;
  };
  github: {
    installations: SetupGithubInstallation[];
    installUrl: string;
    needsAttention: boolean;
    issue: string | null;
  };
  vercel: {
    teams: SetupVercelTeam[];
    tokenPreview: string;
    isValid: boolean;
    issue: string | null;
  } | null;
  githubPages: {
    confirmedAt: number;
  } | null;
  convex: {
    teamId: string;
    teamSlug: string;
    tokenPreview: string;
    isValid: boolean;
    issue: string | null;
  } | null;
  onboarding: {
    hasGitHubConnection: boolean;
    hasVercelConnection: boolean;
    hasConvexToken: boolean;
    canAccessApps: boolean;
    requiredActions: string[];
  };
};
