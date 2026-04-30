import { v } from "convex/values";
import { internalMutation, internalQuery } from "../../../_generated/server";
import type { Doc, Id } from "../../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../../_generated/server";

export const teamValidator = v.object({
  id: v.string(),
  name: v.optional(v.string()),
  slug: v.string(),
});

export type VercelTeam = {
  id: string;
  name: string | undefined;
  slug: string;
};

export const VERCEL_TOKEN_MISSING_MESSAGE = "Add a Vercel token on the setup page before continuing.";
export const VERCEL_TOKEN_NEEDS_ATTENTION_MESSAGE =
  "The saved Vercel token needs attention. Try refreshing it on the setup page, or paste a new token.";

type TokenFields = Doc<"vercelTokens">;
type TokenTeams = TokenFields["teams"];

const vercelTokenForUserValidator = v.object({
  token: v.string(),
  teams: v.array(teamValidator),
  tokenStatus: v.union(v.literal("valid"), v.literal("invalid")),
});

export type VercelTokenForUser = {
  token: string;
  teams: TokenTeams;
  tokenStatus: "valid" | "invalid";
};

type VercelTokenLookupCtx = Pick<QueryCtx | MutationCtx, "db">;

function mapVercelTokenForUser(tokenDoc: TokenFields): VercelTokenForUser {
  return {
    token: tokenDoc.token,
    teams: tokenDoc.teams,
    tokenStatus: tokenDoc.tokenStatus,
  };
}

export async function getVercelTokenDocForUser(
  ctx: VercelTokenLookupCtx,
  userId: Id<"users">,
) {
  return await ctx.db
    .query("vercelTokens")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
}

export async function requireVercelTokenDocForUser(
  ctx: VercelTokenLookupCtx,
  userId: Id<"users">,
  options?: { allowInvalid?: boolean },
) {
  const tokenDoc = await getVercelTokenDocForUser(ctx, userId);
  if (!tokenDoc) {
    throw new Error(VERCEL_TOKEN_MISSING_MESSAGE);
  }
  if (tokenDoc.tokenStatus === "invalid" && options?.allowInvalid !== true) {
    throw new Error(VERCEL_TOKEN_NEEDS_ATTENTION_MESSAGE);
  }
  return tokenDoc;
}

export function getVercelTokenIssue(token: Pick<TokenFields, "tokenStatus"> | null) {
  return token?.tokenStatus === "invalid" ? VERCEL_TOKEN_NEEDS_ATTENTION_MESSAGE : null;
}

export const upsertVercelToken = internalMutation({
  args: {
    userId: v.id("users"),
    token: v.string(),
    teams: v.array(teamValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("vercelTokens")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        token: args.token.trim(),
        teams: args.teams,
        tokenStatus: "valid",
      });
      return null;
    }
    await ctx.db.insert("vercelTokens", {
      userId: args.userId,
      token: args.token.trim(),
      teams: args.teams,
      tokenStatus: "valid",
    });
    return null;
  },
});

export const getVercelTokenForUser = internalQuery({
  args: { userId: v.id("users") },
  returns: v.union(
    vercelTokenForUserValidator,
    v.null(),
  ),
  handler: async (ctx, args) => {
    const tokenDoc = await getVercelTokenDocForUser(ctx, args.userId);
    if (!tokenDoc) return null;
    return mapVercelTokenForUser(tokenDoc);
  },
});

export const requireVercelTokenForUser = internalQuery({
  args: {
    userId: v.id("users"),
    allowInvalid: v.optional(v.boolean()),
  },
  returns: vercelTokenForUserValidator,
  handler: async (ctx, args) => {
    const tokenDoc = await requireVercelTokenDocForUser(ctx, args.userId, {
      allowInvalid: args.allowInvalid,
    });
    return mapVercelTokenForUser(tokenDoc);
  },
});

export const markVercelTokenInvalid = internalMutation({
  args: {
    token: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const tokenDoc = await ctx.db
      .query("vercelTokens")
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

export const getVercelProjectByAppId = internalQuery({
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
      .query("vercelProjects")
      .withIndex("by_app", (q) => q.eq("appId", args.appId))
      .first();
    if (!project) return null;
    return { projectId: project.projectId, teamId: project.teamId };
  },
});

export const insertVercelProject = internalMutation({
  args: {
    appId: v.id("apps"),
    projectId: v.string(),
    projectName: v.string(),
    teamId: v.string(),
    teamSlug: v.string(),
    deploymentUrl: v.optional(v.string()),
  },
  returns: v.id("vercelProjects"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("vercelProjects", {
      appId: args.appId,
      projectId: args.projectId,
      projectName: args.projectName,
      teamId: args.teamId,
      teamSlug: args.teamSlug,
      deploymentUrl: args.deploymentUrl,
    });
  },
});

export const updateVercelProject = internalMutation({
  args: {
    projectId: v.id("vercelProjects"),
    deploymentUrl: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.projectId, {
      deploymentUrl: args.deploymentUrl,
    });
    return null;
  },
});
