"use client";

export type SetupGithubInstallation = {
  id: string;
  accountLogin: string;
  accountName?: string | undefined;
  accountType: string;
  accountAvatarUrl?: string | undefined;
  repositorySelection: string;
};

export type SetupVercelTeam = {
  id: string;
  name?: string | undefined;
  slug: string;
};

export type SetupBusyState =
  | "github-refresh"
  | "vercel-refresh"
  | "vercel-save"
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
