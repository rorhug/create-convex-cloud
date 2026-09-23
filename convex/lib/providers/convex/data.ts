import { v } from "convex/values";
import type { Doc, Id } from "../../../_generated/dataModel";
import { internalMutation, internalQuery } from "../../../_generated/server";
import type { MutationCtx, QueryCtx } from "../../../_generated/server";

const MAX_CONVEX_TEAMS_PER_USER = 100;

export async function listConvexAuthAccountsForUser(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
): Promise<Doc<"authAccounts">[]> {
  return await ctx.db
    .query("authAccounts")
    .withIndex("userIdAndProvider", (q) => q.eq("userId", userId).eq("provider", "convex"))
    .take(MAX_CONVEX_TEAMS_PER_USER);
}

export async function listConvexTokenDocsForUser(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
): Promise<Doc<"convexTokens">[]> {
  const accounts = await listConvexAuthAccountsForUser(ctx, userId);
  const tokens: Doc<"convexTokens">[] = [];
  for (const account of accounts) {
    const token = await getConvexTokenByProviderAccount(ctx, account.providerAccountId);
    if (token) {
      tokens.push(token);
    }
  }
  return tokens;
}

export async function getConvexTokenDocForTeam(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  teamId: string,
): Promise<Doc<"convexTokens"> | null> {
  const trimmedTeamId = teamId.trim();
  if (!trimmedTeamId) {
    return null;
  }
  const tokens = await listConvexTokenDocsForUser(ctx, userId);
  return tokens.find((token) => token.teamId === trimmedTeamId) ?? null;
}

async function getConvexTokenByProviderAccount(
  ctx: QueryCtx | MutationCtx,
  providerAccountId: string,
): Promise<Doc<"convexTokens"> | null> {
  return await ctx.db
    .query("convexTokens")
    .withIndex("by_provider_account", (q) => q.eq("providerAccountId", providerAccountId))
    .first();
}

export async function upsertConvexToken(
  ctx: MutationCtx,
  fields: {
    providerAccountId: string;
    token: string;
    teamId: string;
    teamSlug: string;
  },
) {
  const existing = await getConvexTokenByProviderAccount(ctx, fields.providerAccountId);

  const tokenDoc = {
    providerAccountId: fields.providerAccountId,
    teamId: fields.teamId,
    teamSlug: fields.teamSlug,
    token: fields.token.trim(),
    tokenStatus: "valid" as const,
  };

  if (existing) {
    await ctx.db.patch(existing._id, tokenDoc);
    return;
  }

  await ctx.db.insert("convexTokens", tokenDoc);
}

export const convexTokenValidator = v.object({
  token: v.string(),
  teamId: v.string(),
  teamSlug: v.string(),
  tokenStatus: v.union(v.literal("valid"), v.literal("invalid")),
});

function mapConvexToken(tokenDoc: Doc<"convexTokens">) {
  return {
    token: tokenDoc.token,
    teamId: tokenDoc.teamId,
    teamSlug: tokenDoc.teamSlug,
    tokenStatus: tokenDoc.tokenStatus,
  };
}

export const listConvexTokensForUser = internalQuery({
  args: { userId: v.id("users") },
  returns: v.array(convexTokenValidator),
  handler: async (ctx, args) => {
    const tokens = await listConvexTokenDocsForUser(ctx, args.userId);
    return tokens.map(mapConvexToken);
  },
});

export const getConvexTokenForTeam = internalQuery({
  args: {
    userId: v.id("users"),
    teamId: v.string(),
  },
  returns: v.union(convexTokenValidator, v.null()),
  handler: async (ctx, args) => {
    const tokenDoc = await getConvexTokenDocForTeam(ctx, args.userId, args.teamId);
    if (!tokenDoc) return null;
    return mapConvexToken(tokenDoc);
  },
});

export const markConvexTokenInvalid = internalMutation({
  args: {
    token: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const tokenDoc = await ctx.db
      .query("convexTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token.trim()))
      .first();
    if (!tokenDoc) {
      return null;
    }
    await ctx.db.patch(tokenDoc._id, {
      tokenStatus: "invalid",
    });
    return null;
  },
});

export const markConvexTokenValid = internalMutation({
  args: {
    token: v.string(),
    teamId: v.string(),
    teamSlug: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const tokenDoc = await ctx.db
      .query("convexTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token.trim()))
      .first();
    if (!tokenDoc) {
      return null;
    }
    await ctx.db.patch(tokenDoc._id, {
      teamId: args.teamId,
      teamSlug: args.teamSlug,
      tokenStatus: "valid",
    });
    return null;
  },
});

export const getConvexProjectByAppId = internalQuery({
  args: { appId: v.id("apps") },
  returns: v.union(
    v.object({
      projectId: v.string(),
      teamId: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const project = await ctx.db
      .query("convexProjects")
      .withIndex("by_app", (q) => q.eq("appId", args.appId))
      .first();
    if (!project) return null;
    return { projectId: project.projectId, teamId: project.teamId };
  },
});

export const getConvexDeployKeysByAppId = internalQuery({
  args: { appId: v.id("apps") },
  returns: v.union(
    v.object({
      prodDeployKey: v.string(),
      previewDeployKey: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const project = await ctx.db
      .query("convexProjects")
      .withIndex("by_app", (q) => q.eq("appId", args.appId))
      .first();
    if (!project?.prodDeployKey || !project.previewDeployKey) return null;
    return {
      prodDeployKey: project.prodDeployKey,
      previewDeployKey: project.previewDeployKey,
    };
  },
});

export const insertConvexProject = internalMutation({
  args: {
    appId: v.id("apps"),
    projectId: v.string(),
    teamId: v.string(),
    teamSlug: v.string(),
    projectSlug: v.string(),
    prodDeploymentName: v.string(),
    prodDeployKey: v.string(),
    previewDeployKey: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("convexProjects", {
      appId: args.appId,
      projectId: args.projectId,
      teamId: args.teamId,
      teamSlug: args.teamSlug,
      projectSlug: args.projectSlug,
      prodDeploymentName: args.prodDeploymentName,
      prodDeployKey: args.prodDeployKey,
      previewDeployKey: args.previewDeployKey,
    });
    return null;
  },
});
