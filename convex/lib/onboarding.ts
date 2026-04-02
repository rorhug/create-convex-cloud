import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { getGithubTokenDocForUser } from "./githubAuthAccount";

export async function getViewerState(ctx: QueryCtx, user: Doc<"users">) {
  const githubToken = await getGithubTokenDocForUser(ctx, user._id);
  const hasGitHubConnection = githubToken !== null;

  const vercelToken = await ctx.db
    .query("vercelTokens")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .first();
  const hasVercelConnection = vercelToken !== null;

  const convexToken = await ctx.db
    .query("convexTokens")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .first();
  const hasConvexToken = convexToken !== null;

  return {
    user: {
      name: user.name ?? null,
      email: user.email ?? null,
      image: user.image ?? null,
      githubUsername: githubToken?.username ?? null,
    },
    vercel: hasVercelConnection
      ? {
          teams: vercelToken.teams,
          tokenPreview: maskSecret(vercelToken.token),
        }
      : null,
    convex: hasConvexToken
      ? {
          teamId: convexToken.teamId,
          tokenPreview: maskSecret(convexToken.token),
        }
      : null,
    onboarding: {
      hasGitHubConnection,
      hasVercelConnection,
      hasConvexToken,
      canAccessApps:
        hasGitHubConnection && hasVercelConnection && hasConvexToken,
    },
  };
}

export async function createAppForUser(
  ctx: MutationCtx,
  userId: Id<"users">,
  name: string,
) {
  const trimmedName = name.trim();
  if (trimmedName.length < 2) {
    throw new Error("App name must be at least 2 characters");
  }
  if (trimmedName.length > 64) {
    throw new Error("App name must be 64 characters or fewer");
  }

  return await ctx.db.insert("apps", {
    ownerId: userId,
    name: trimmedName,
    status: "creating",
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
