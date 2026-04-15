import { v } from "convex/values";
import type { Doc, Id } from "../../../_generated/dataModel";
import { internalMutation, internalQuery } from "../../../_generated/server";
import type { MutationCtx, QueryCtx } from "../../../_generated/server";
import type { GithubProfileWithTokens } from "../../../authProviders/github";
import { type GithubInstallation, githubAccessTokenNeedsRefresh } from "./platform";

export const githubInstallationValidator = v.object({
  id: v.string(),
  accountLogin: v.string(),
  accountName: v.optional(v.string()),
  accountType: v.string(),
  accountAvatarUrl: v.optional(v.string()),
  repositorySelection: v.string(),
});

export async function findGithubAuthAccountForUser(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
): Promise<Doc<"authAccounts"> | null> {
  return await ctx.db
    .query("authAccounts")
    .withIndex("userIdAndProvider", (q) => q.eq("userId", userId).eq("provider", "github"))
    .unique();
}

/**
 * GitHub OAuth token row for this user: resolve `authAccounts.providerAccountId` (GitHub user id string),
 * then load `githubTokens` by `githubUserId`.
 */
export async function getGithubTokenDocForUser(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
): Promise<Doc<"githubTokens"> | null> {
  const account = await findGithubAuthAccountForUser(ctx, userId);
  if (account === null) return null;
  return await ctx.db
    .query("githubTokens")
    .withIndex("by_github_user_id", (q) => q.eq("githubUserId", account.providerAccountId))
    .first();
}

export type GithubTokenFields = {
  githubUserId: string;
  accessToken: string;
  accessTokenExpiresAt?: number;
  refreshToken?: string;
  username?: string;
  installations?: GithubInstallation[];
};

export function githubTokenFieldsFromProfile(profile: GithubProfileWithTokens): GithubTokenFields {
  const githubUserId =
    typeof profile.githubUserId === "string" && profile.githubUserId.length > 0
      ? profile.githubUserId
      : typeof profile.id === "string" && profile.id.length > 0
        ? profile.id
        : "";
  if (githubUserId.length === 0) {
    throw new Error("GitHub profile is missing githubUserId (and id was stripped by Convex Auth)");
  }

  const accessToken = profile.accessToken;
  if (typeof accessToken !== "string" || accessToken.length === 0) {
    throw new Error("GitHub OAuth did not return an access token");
  }

  return {
    githubUserId,
    accessToken,
    accessTokenExpiresAt:
      typeof profile.accessTokenExpiresAt === "number" && Number.isFinite(profile.accessTokenExpiresAt)
        ? profile.accessTokenExpiresAt
        : undefined,
    refreshToken:
      typeof profile.refreshToken === "string" && profile.refreshToken.length > 0
        ? profile.refreshToken
        : undefined,
    username: profile.username,
  };
}

export async function upsertGithubTokenForGithubUser(ctx: MutationCtx, fields: GithubTokenFields) {
  const existing = await ctx.db
    .query("githubTokens")
    .withIndex("by_github_user_id", (q) => q.eq("githubUserId", fields.githubUserId))
    .first();

  const tokenDoc = {
    githubUserId: fields.githubUserId,
    token: fields.accessToken,
    tokenStatus: "valid" as const,
    installations: fields.installations ?? [],
    ...(fields.accessTokenExpiresAt !== undefined
      ? { accessTokenExpiresAt: fields.accessTokenExpiresAt }
      : {}),
    ...(fields.refreshToken !== undefined ? { refreshToken: fields.refreshToken } : {}),
    ...(fields.username !== undefined ? { username: fields.username } : {}),
  };

  if (existing) {
    await ctx.db.patch(existing._id, tokenDoc);
    return;
  }

  await ctx.db.insert("githubTokens", tokenDoc);
}

export const getGithubConnection = internalQuery({
  args: { userId: v.id("users") },
  returns: v.union(
    v.object({
      githubAccessToken: v.union(v.string(), v.null()),
      githubAccessTokenExpiresAt: v.union(v.number(), v.null()),
      githubAccessTokenNeedsRefresh: v.boolean(),
      githubUsername: v.union(v.string(), v.null()),
      githubTokenStatus: v.union(v.literal("valid"), v.literal("invalid")),
      githubInstallations: v.array(githubInstallationValidator),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const githubToken = await getGithubTokenDocForUser(ctx, args.userId);
    if (!githubToken) return null;
    const expiresAt = githubToken.accessTokenExpiresAt;
    return {
      githubAccessToken: githubToken.token,
      githubAccessTokenExpiresAt: expiresAt ?? null,
      githubAccessTokenNeedsRefresh: githubAccessTokenNeedsRefresh(expiresAt),
      githubUsername: githubToken.username ?? null,
      githubTokenStatus: githubToken.tokenStatus,
      githubInstallations: githubToken.installations,
    };
  },
});

export const getGithubRepoByAppId = internalQuery({
  args: { appId: v.id("apps") },
  returns: v.union(
    v.object({
      repoFullName: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const repo = await ctx.db
      .query("githubRepos")
      .withIndex("by_app", (q) => q.eq("appId", args.appId))
      .first();
    if (!repo) return null;
    return { repoFullName: repo.repoFullName };
  },
});

export const getGithubTokenRowForRefresh = internalQuery({
  args: { userId: v.id("users") },
  returns: v.union(
    v.null(),
    v.object({
      githubUserId: v.string(),
      token: v.string(),
      accessTokenExpiresAt: v.optional(v.number()),
      refreshToken: v.optional(v.string()),
      username: v.optional(v.string()),
      installations: v.array(githubInstallationValidator),
    }),
  ),
  handler: async (ctx, args) => {
    const doc = await getGithubTokenDocForUser(ctx, args.userId);
    if (!doc) return null;
    return {
      githubUserId: doc.githubUserId,
      token: doc.token,
      accessTokenExpiresAt: doc.accessTokenExpiresAt,
      refreshToken: doc.refreshToken,
      username: doc.username,
      installations: doc.installations,
    };
  },
});

export const applyGithubOAuthRefresh = internalMutation({
  args: {
    githubUserId: v.string(),
    accessToken: v.string(),
    accessTokenExpiresAt: v.optional(v.number()),
    refreshToken: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("githubTokens")
      .withIndex("by_github_user_id", (q) => q.eq("githubUserId", args.githubUserId))
      .first();
    if (!existing) {
      throw new Error("githubTokens row not found for GitHub user");
    }
    const patch: {
      token: string;
      accessTokenExpiresAt?: number;
      refreshToken?: string;
      tokenStatus: "valid";
    } = {
      token: args.accessToken,
      tokenStatus: "valid",
    };
    if (args.accessTokenExpiresAt !== undefined) {
      patch.accessTokenExpiresAt = args.accessTokenExpiresAt;
    }
    if (args.refreshToken !== undefined) {
      patch.refreshToken = args.refreshToken;
    }
    await ctx.db.patch(existing._id, patch);
    return null;
  },
});

export const updateGithubInstallations = internalMutation({
  args: {
    githubUserId: v.string(),
    installations: v.array(githubInstallationValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("githubTokens")
      .withIndex("by_github_user_id", (q) => q.eq("githubUserId", args.githubUserId))
      .first();
    if (!existing) {
      throw new Error("githubTokens row not found for GitHub user");
    }
    await ctx.db.patch(existing._id, {
      installations: args.installations,
      tokenStatus: "valid",
    });
    return null;
  },
});

export const markGithubTokenInvalid = internalMutation({
  args: {
    token: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("githubTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token.trim()))
      .first();
    if (!existing) {
      return null;
    }
    await ctx.db.patch(existing._id, {
      tokenStatus: "invalid",
    });
    return null;
  },
});

export const insertGithubRepo = internalMutation({
  args: {
    appId: v.id("apps"),
    repoFullName: v.string(),
    repoUrl: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("githubRepos", {
      appId: args.appId,
      repoFullName: args.repoFullName,
      repoUrl: args.repoUrl,
    });
    return null;
  },
});
