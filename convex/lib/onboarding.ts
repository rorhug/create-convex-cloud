import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export function getViewerState(user: Doc<"users">) {
  const hasVercelConnection = Boolean(user.vercelUserId);
  const hasConvexTeamAccessToken = Boolean(
    user.convexTeamAccessToken && user.convexTeamId,
  );

  return {
    user: {
      name: user.name ?? null,
      email: user.email ?? null,
      image: user.image ?? null,
    },
    vercel: hasVercelConnection
      ? {
          name: user.vercelName ?? null,
          email: user.vercelEmail ?? null,
          username: user.vercelUsername ?? null,
          avatarUrl: user.vercelAvatarUrl ?? null,
        }
      : null,
    convex: hasConvexTeamAccessToken
      ? {
          teamId: user.convexTeamId ?? "",
          tokenPreview: maskSecret(user.convexTeamAccessToken ?? ""),
        }
      : null,
    onboarding: {
      hasGitHubConnection: true,
      hasVercelConnection,
      hasConvexTeamAccessToken,
      canAccessApps: hasVercelConnection && hasConvexTeamAccessToken,
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

function maskSecret(value: string) {
  if (value.length <= 8) {
    return "********";
  }
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}
