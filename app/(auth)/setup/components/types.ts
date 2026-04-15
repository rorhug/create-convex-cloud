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
  | "vercel-verify"
  | "vercel-save"
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
  };
  vercel: {
    teams: SetupVercelTeam[];
    tokenPreview: string;
  } | null;
  convex: {
    teamId: string;
    tokenPreview: string;
  } | null;
  onboarding: {
    hasGitHubConnection: boolean;
    hasVercelConnection: boolean;
    hasConvexToken: boolean;
    canAccessApps: boolean;
  };
};
