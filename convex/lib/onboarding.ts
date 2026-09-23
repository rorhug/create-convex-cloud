import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { assertValidAppName } from "./appName";
import { getGithubTokenDocForUser } from "./providers/github/data";
import { listConvexTokenDocsForUser } from "./providers/convex/data";
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

  const convexTokens = await listConvexTokenDocsForUser(ctx, user._id);
  const convexTeams = convexTokens
    .map((token) => {
      const issue =
        token.tokenStatus === "invalid"
          ? "The saved Convex token is no longer valid. Reconnect Convex on the setup page."
          : null;
      return {
        teamId: token.teamId,
        teamSlug: token.teamSlug,
        tokenPreview: maskSecret(token.token),
        isValid: issue === null,
        issue,
      };
    })
    .sort((a, b) => a.teamSlug.localeCompare(b.teamSlug) || a.teamId.localeCompare(b.teamId));
  const hasConvexToken = convexTeams.length > 0;
  const hasValidConvexToken = convexTeams.some((team) => team.isValid);

  const requiredActions: string[] = [];
  if (!hasGitHubConnection) {
    requiredActions.push(
      "Install the GitHub App and refresh your installations on the setup page.",
    );
  } else if (githubIssue) {
    requiredActions.push(githubIssue);
  }
  if (!hasVercelConnection) {
    requiredActions.push("Add a Vercel access token on the setup page.");
  } else if (vercelIssue) {
    requiredActions.push(vercelIssue);
  }
  if (!hasConvexToken) {
    requiredActions.push("Connect a Convex team on the setup page.");
  } else if (!hasValidConvexToken) {
    requiredActions.push(
      "The saved Convex token is no longer valid. Reconnect Convex on the setup page.",
    );
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
    convex: hasConvexToken
      ? {
          teams: convexTeams,
        }
      : null,
    onboarding: {
      hasGitHubConnection,
      hasVercelConnection,
      hasConvexToken,
      requiredActions,
      canAccessApps:
        hasGitHubConnection &&
        hasVercelConnection &&
        hasValidConvexToken &&
        githubIssue === null &&
        vercelIssue === null,
    },
  };
}

export async function createAppForUser(
  ctx: MutationCtx,
  userId: Id<"users">,
  name: string,
  options: {
    vercelTeamId: string;
    githubInstallationId: string;
    githubRepoPrivate: boolean;
    convexTeamId: string;
  },
) {
  assertValidAppName(name);

  return await ctx.db.insert("apps", {
    ownerId: userId,
    name,
    vercelTeamId: options.vercelTeamId,
    githubInstallationId: options.githubInstallationId,
    githubRepoPrivate: options.githubRepoPrivate,
    convexTeamId: options.convexTeamId,
    githubRepoCreationMethod: "template",
    status: "creating",
    workflowKind: "create",
    createdAt: Date.now(),
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
