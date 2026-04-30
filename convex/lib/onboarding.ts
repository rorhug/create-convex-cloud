import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { getGithubTokenDocForUser } from "./providers/github/data";
import { findConvexAuthAccountForUser } from "./providers/convex/data";
import { getGithubAppInstallUrl } from "./providers/github/platform";
import { getVercelTokenDocForUser, getVercelTokenIssue } from "./providers/vercel/data";

export async function getViewerState(ctx: QueryCtx, user: Doc<"users">) {
  const githubToken = await getGithubTokenDocForUser(ctx, user._id);
  const githubInstallations = githubToken?.installations ?? [];
  const hasGitHubConnection = githubInstallations.length > 0;
  const githubIssue =
    githubToken?.tokenStatus === "invalid"
      ? "GitHub access needs attention. Sign in with GitHub again."
      : null;

  const vercelToken = await getVercelTokenDocForUser(ctx, user._id);
  const hasVercelConnection = vercelToken !== null;
  const vercelIssue = getVercelTokenIssue(vercelToken);

  const githubPagesPreference = await ctx.db
    .query("githubPagesPreferences")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .first();
  const hasConfirmedGithubPages = githubPagesPreference !== null;

  const convexAccount = await findConvexAuthAccountForUser(ctx, user._id);
  const convexToken = convexAccount
    ? await ctx.db
        .query("convexTokens")
        .withIndex("by_provider_account", (q) => q.eq("providerAccountId", convexAccount.providerAccountId))
        .first()
    : null;
  const hasConvexToken = convexToken !== null;
  const convexIssue =
    convexToken?.tokenStatus === "invalid"
      ? "The saved Convex token is no longer valid. Reconnect Convex on the setup page."
      : null;
  
  const hasDeploymentTarget =
    (hasVercelConnection && vercelIssue === null) ||
    (hasGitHubConnection && githubIssue === null && hasConfirmedGithubPages);

  const requiredActions: string[] = [];
  if (!hasGitHubConnection) {
    requiredActions.push(
      "Install the GitHub App and refresh your installations on the setup page.",
    );
  } else if (githubIssue) {
    requiredActions.push(githubIssue);
  }
  if (vercelIssue) {
    requiredActions.push(vercelIssue);
  }
  if (!hasConvexToken) {
    requiredActions.push("Connect a Convex team on the setup page.");
  } else if (convexIssue) {
    requiredActions.push(convexIssue);
  }

  return {
    user: {
      name: user.name ?? null,
      email: user.email ?? null,
      image: user.image ?? null,
      githubUsername: githubToken?.username ?? null,
    },
    github: {
      installations: githubInstallations,
      installUrl: getGithubAppInstallUrl(),
      needsAttention: githubIssue !== null,
      issue: githubIssue,
    },
    vercel: hasVercelConnection
      ? {
          teams: vercelToken.teams,
          tokenPreview: maskSecret(vercelToken.token),
          isValid: vercelIssue === null,
          issue: vercelIssue,
        }
      : null,
    githubPages: hasConfirmedGithubPages
      ? { confirmedAt: githubPagesPreference.confirmedAt }
      : null,
    convex: hasConvexToken
      ? {
          teamId: convexToken.teamId,
          teamSlug: convexToken.teamSlug,
          tokenPreview: maskSecret(convexToken.token),
          isValid: convexIssue === null,
          issue: convexIssue,
        }
      : null,
    onboarding: {
      hasGitHubConnection,
      hasVercelConnection,
      hasConvexToken,
      requiredActions,
      canAccessApps:
        hasGitHubConnection &&
        githubIssue === null &&
        hasDeploymentTarget &&
        hasConvexToken &&
        convexIssue === null,
    },
  };
}

export async function createAppForUser(
  ctx: MutationCtx,
  userId: Id<"users">,
  name: string,
  options: {
    deploymentTarget:
      | { type: "vercel"; vercelTeamId: string }
      | { type: "github-pages" };
    githubInstallationId: string;
    githubRepoPrivate: boolean;
  },
) {
  const trimmedName = name.trim();
  if (trimmedName.length < 2) {
    throw new Error("App name must be at least 2 characters");
  }
  if (trimmedName.length > 64) {
    throw new Error("App name must be 64 characters or fewer");
  }

  const baseFields = {
    ownerId: userId,
    name: trimmedName,
    githubInstallationId: options.githubInstallationId,
    githubRepoPrivate: options.githubRepoPrivate,
    githubRepoCreationMethod: "template" as const,
    status: "creating" as const,
    workflowKind: "create" as const,
    createdAt: Date.now(),
  };

  if (options.deploymentTarget.type === "vercel") {
    return await ctx.db.insert("apps", {
      ...baseFields,
      deploymentTarget: "vercel",
      vercelTeamId: options.deploymentTarget.vercelTeamId,
    });
  }

  return await ctx.db.insert("apps", {
    ...baseFields,
    deploymentTarget: "github-pages",
  });
}

export async function listAppsForUser(ctx: QueryCtx, userId: Id<"users">) {
  return await ctx.db
    .query("apps")
    .withIndex("by_owner", (q) => q.eq("ownerId", userId))
    .order("desc")
    .collect();
}

export async function deleteAppForUser(
  ctx: MutationCtx,
  userId: Id<"users">,
  appId: Id<"apps">,
) {
  const app = await ctx.db.get(appId);
  if (!app) {
    throw new Error("App not found");
  }
  if (app.ownerId !== userId) {
    throw new Error("You do not own this app");
  }

  // Delete associated resources
  const githubRepo = await ctx.db
    .query("githubRepos")
    .withIndex("by_app", (q) => q.eq("appId", appId))
    .first();
  if (githubRepo) await ctx.db.delete(githubRepo._id);

  const convexProject = await ctx.db
    .query("convexProjects")
    .withIndex("by_app", (q) => q.eq("appId", appId))
    .first();
  if (convexProject) await ctx.db.delete(convexProject._id);

  const vercelProject = await ctx.db
    .query("vercelProjects")
    .withIndex("by_app", (q) => q.eq("appId", appId))
    .first();
  if (vercelProject) await ctx.db.delete(vercelProject._id);

  // Delete step records
  const steps = await ctx.db
    .query("appSteps")
    .withIndex("by_app", (q) => q.eq("appId", appId))
    .collect();
  for (const step of steps) {
    await ctx.db.delete(step._id);
  }

  await ctx.db.delete(appId);
}

function maskSecret(value: string) {
  if (value.length <= 8) {
    return "********";
  }
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}
